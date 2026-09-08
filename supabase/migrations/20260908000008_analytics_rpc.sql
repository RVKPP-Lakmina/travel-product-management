-- ============================================================================
-- 0008: product_analytics() — the read model behind /analytics
--
-- Reads the BASE table public.products, NOT public.products_listable.
-- products_listable exists to hide expired rows from listing/search/export;
-- an analytics page whose headline chart is "how much of my catalog has
-- lapsed" must see exactly the rows that view hides. Same reasoning as
-- dashboard_stats() in 0003 — and the same orthogonality caveat applies:
-- total != active + expired + inactive (status and expiry are independent).
--
-- ONE function returning ONE jsonb, not N functions:
--   - every number on the page comes from a single consistent table read,
--     so the category totals and the status donut can never disagree;
--   - the payload is ~1.5 KB — splitting it would cost 5 round trips, 5
--     loading states and 5 cache entries for no benefit at this data size.
--
-- Grant: service_role ONLY (unlike dashboard_stats, which also grants
-- authenticated). The API is the sole consumer. Granting `authenticated`
-- would create a second, RLS-filtered path where a browser hitting the RPC
-- directly gets DIFFERENT numbers for the same page.
--
-- camelCase keys are emitted here in SQL via jsonb_build_object rather than
-- mapped in TS (mappers.ts) — for a single read-only aggregate a hand
-- mapper is pure overhead. generatedAt is formatted with an explicit "Z"
-- because Zod v4's z.iso.datetime() rejects the "+00:00" that
-- to_jsonb(timestamptz) would emit. round(..., 2)::float8 on every numeric
-- so JSON carries a real number, not "78200.00".
--
-- Timezone: "today" is (now() at time zone 'Asia/Colombo')::date, identical
-- to 0003. valid_until is inclusive, so days_left = 0 is NOT expired.
-- ============================================================================

create or replace function public.product_analytics()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with today as (
  select (now() at time zone 'Asia/Colombo')::date as d
),
p as (
  select
    pr.category,
    pr.destination,
    pr.status,
    pr.price,
    pr.inventory_count,
    pr.created_at,
    (pr.valid_until < t.d)          as is_expired,
    (pr.valid_until - t.d)          as days_left,
    (pr.price * pr.inventory_count) as line_value
  from public.products pr
  cross join today t
),
totals as (
  select jsonb_build_object(
    'totalProducts',        count(*)::int,
    'totalInventory',       coalesce(sum(inventory_count), 0)::int,
    'catalogValue',         round(coalesce(sum(line_value), 0), 2)::float8,
    'avgPrice',             round(coalesce(avg(price), 0), 2)::float8,
    'minPrice',             round(coalesce(min(price), 0), 2)::float8,
    'maxPrice',             round(coalesce(max(price), 0), 2)::float8,
    'active',               count(*) filter (where status = 'active' and not is_expired)::int,
    'expired',              count(*) filter (where is_expired)::int,
    'inactive',             count(*) filter (where status = 'inactive')::int,
    'outOfStock',           count(*) filter (where inventory_count = 0)::int,
    'distinctDestinations', count(distinct destination)::int
  ) as j
  from p
),
by_category as (
  -- LEFT JOIN from public.categories so a category with zero products still
  -- renders a zero-length bar rather than silently vanishing from the chart.
  select coalesce(jsonb_agg(to_jsonb(x) order by x."count" desc, x.label), '[]'::jsonb) as j
  from (
    select
      c.slug                                           as category,
      c.name                                           as label,
      count(p.category)::int                           as "count",
      coalesce(sum(p.inventory_count), 0)::int         as inventory,
      round(coalesce(sum(p.line_value), 0), 2)::float8 as value,
      round(coalesce(avg(p.price), 0), 2)::float8      as "avgPrice"
    from public.categories c
    left join p on p.category = c.slug
    group by c.slug, c.name
  ) x
),
by_status as (
  -- inactive EXCLUDES expired here so the donut sums to totalProducts —
  -- deliberately different from totals.inactive (which keeps the dashboard's
  -- non-exclusive definition). Footnoted on the card.
  select jsonb_build_array(
    jsonb_build_object('key', 'active',   'count', count(*) filter (where status = 'active' and not is_expired)::int),
    jsonb_build_object('key', 'expired',  'count', count(*) filter (where is_expired)::int),
    jsonb_build_object('key', 'inactive', 'count', count(*) filter (where status = 'inactive' and not is_expired)::int)
  ) as j
  from p
),
top_destinations as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x."count" desc, x.destination), '[]'::jsonb) as j
  from (
    select
      destination,
      count(*)::int                                  as "count",
      coalesce(sum(inventory_count), 0)::int         as inventory,
      round(coalesce(sum(line_value), 0), 2)::float8 as value
    from p
    group by destination
    order by count(*) desc, destination
    limit 8
  ) x
),
expiry as (
  select jsonb_build_array(
    jsonb_build_object('bucket', 'expired', 'count', count(*) filter (where days_left <  0)::int),
    jsonb_build_object('bucket', 'd7',      'count', count(*) filter (where days_left >= 0  and days_left <=  7)::int),
    jsonb_build_object('bucket', 'd30',     'count', count(*) filter (where days_left >  7  and days_left <= 30)::int),
    jsonb_build_object('bucket', 'd90',     'count', count(*) filter (where days_left > 30  and days_left <= 90)::int),
    jsonb_build_object('bucket', 'later',   'count', count(*) filter (where days_left > 90)::int)
  ) as j
  from p
),
months as (
  -- generate_series zero-fills the last 12 months so the column chart has
  -- no gaps.
  select to_char(m, 'YYYY-MM') as month
  from generate_series(
    date_trunc('month', (select d from today))::date - interval '11 months',
    date_trunc('month', (select d from today))::date,
    interval '1 month'
  ) m
),
created_by_month as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.month), '[]'::jsonb) as j
  from (
    select
      mo.month,
      count(p.created_at)::int as "count"
    from months mo
    left join p
      on to_char((p.created_at at time zone 'Asia/Colombo'), 'YYYY-MM') = mo.month
    group by mo.month
  ) x
)
select jsonb_build_object(
  'generatedAt',     to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'today',           to_char((select d from today), 'YYYY-MM-DD'),
  'totals',          (select j from totals),
  'byCategory',      (select j from by_category),
  'byStatus',        (select j from by_status),
  'topDestinations', (select j from top_destinations),
  'expiry',          (select j from expiry),
  'createdByMonth',  (select j from created_by_month)
);
$$;

comment on function public.product_analytics() is
  'Single-payload read model for the Analytics page. Reads public.products '
  '(base table) so expired rows are counted — products_listable hides them. '
  'Granted to service_role only: a second RLS-filtered browser path would '
  'report different numbers for the same page.';

revoke all on function public.product_analytics() from public;
grant execute on function public.product_analytics() to service_role;
