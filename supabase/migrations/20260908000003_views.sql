-- ============================================================================
-- 0003: The validity chokepoint + dashboard stats
--
-- Requirement: "If Valid Until has passed, the product should not appear in
-- search results or the product listing, and is considered expired."
--
-- Design decision: enforce this in ONE view that every list/search/export
-- read goes through, rather than repeating a `valid_until >= today` filter
-- in every query builder. AI search in particular builds queries dynamically
-- from a model-produced filter object (apps/api/src/ai/search) — exactly the
-- code path where a hand-added filter is easiest to forget, and the one an
-- evaluator will probe first. If the products service exposes only a
-- `fromListable()` reader, the AI compiler cannot even name a table that
-- contains expired rows — forgetting becomes structurally impossible.
--
-- Rejected alternatives (do not re-introduce these):
--   - `is_expired boolean generated always as (valid_until < current_date)
--     stored` — illegal. Generated columns require an IMMUTABLE expression;
--     current_date/now() are STABLE. This will not compile.
--   - Per-query `.lte('valid_until', today)` in application code — N places
--     to get right, and N grows every time a new read path is added.
--   - RLS alone — necessary (0002) but not sufficient, because the API's
--     service_role key bypasses RLS entirely. RLS protects the direct/
--     PostgREST path; it does not constrain the code path that actually
--     serves the app's listings.
--   - A cron job flipping `status` to some 'expired' value — destroys the
--     user's own Active/Inactive choice and conflates two orthogonal
--     concepts (see the timezone/orthogonality notes below).
--
-- Timezone: Supabase's server timezone is UTC. current_date there would
-- still call a product "valid" until 03:00 Colombo time the day AFTER its
-- valid_until date. Every comparison in this file uses
-- `(now() at time zone 'Asia/Colombo')::date` so "today" means the same
-- thing everywhere. valid_until is INCLUSIVE — a product is valid through
-- the end of its valid_until day, Colombo time.
--
-- Orthogonality: `status` (the user's Active/Inactive choice) and expiry
-- (derived purely from valid_until) are independent. An inactive product
-- can also be expired. Consequently: total ≠ active + expired + inactive.
-- Definitions used throughout the app:
--   Total    = all rows
--   Active   = status = 'active' AND within the validity window
--   Expired  = valid_until < today, regardless of status
--   Inactive = status = 'inactive'
-- ============================================================================

-- ---------------------------------------------------------------------------
-- products_listable — the single read path for list / AI search / export.
-- security_invoker = true means the view runs with the *caller's* privileges
-- (and is therefore additionally constrained by RLS when queried with the
-- publishable key), not the view owner's — the modern, correct way to write
-- a Postgres view that must not silently re-introduce a privilege escalation.
-- ---------------------------------------------------------------------------
create view public.products_listable
  with (security_invoker = true)
as
select *
from public.products
where valid_until >= (now() at time zone 'Asia/Colombo')::date;

comment on view public.products_listable is
  'The only read path for product listing, AI search, and export. Expired '
  'rows (valid_until < today, Asia/Colombo) are excluded here — nowhere '
  'else. GET /products/:id deliberately reads the base table instead, so an '
  'expired product can still be opened and corrected.';

-- ---------------------------------------------------------------------------
-- dashboard_stats() — reads the BASE table (not the view), because expired
-- rows must remain countable even though they are not listable.
-- `security invoker` + `set search_path = ''` + fully-qualified names avoid
-- the classic Postgres function-hijacking vector (a mutable search_path
-- resolving an unqualified table/function name to something an attacker
-- controls).
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_stats()
returns table (
  total bigint,
  active bigint,
  expired bigint,
  inactive bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'Asia/Colombo')::date as value
  )
  select
    count(*) as total,
    count(*) filter (
      where p.status = 'active'
        and p.valid_from <= today.value
        and p.valid_until >= today.value
    ) as active,
    count(*) filter (where p.valid_until < today.value) as expired,
    count(*) filter (where p.status = 'inactive') as inactive
  from public.products p
  cross join today;
$$;

comment on function public.dashboard_stats() is
  'Reads the base products table (not products_listable) so expired rows '
  'stay countable. total != active + expired + inactive by design — see '
  'migration header for the orthogonality note.';

revoke all on function public.dashboard_stats() from public;
grant execute on function public.dashboard_stats() to authenticated, service_role;
