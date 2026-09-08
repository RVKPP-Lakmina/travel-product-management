-- ============================================================================
-- 0002: Row Level Security
--
-- Why this matters even though the Nest API uses the service_role key
-- (which has BYPASSRLS and is unaffected by every policy below):
--
--   1. The Supabase publishable/anon key ships inside the browser bundle by
--      design (apps/web/.env → VITE_SUPABASE_PUBLISHABLE_KEY). Anyone can
--      take that key and call https://<project>.supabase.co/rest/v1/products
--      directly — completely bypassing Nest, its guards, its throttler, and
--      its validity filter. RLS is the ONLY thing standing there. Without
--      it, the publishable key is a full read/write grant on the table.
--   2. Defense in depth if the service_role key ever leaks, or a future
--      feature moves a read onto the client.
--   3. `auto_expose_new_tables` defaults to true in Supabase — a new table
--      is reachable by the Data API roles the moment it's created unless
--      RLS is enabled in the same migration. Never create a table without
--      immediately enabling and policing it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
alter table public.products enable row level security;

-- No policy for `anon` is created on purpose: no policy = deny. The
-- application has no unauthenticated read/write path onto this table.
revoke all on public.products from anon;

-- authenticated: may only ever see rows within their validity window.
-- This mirrors (but does not replace) the products_listable view added in
-- 0003 — RLS is the outer wall for direct/PostgREST access; the view is the
-- chokepoint the API's own query paths (list/search/export) go through.
create policy products_select_authenticated
  on public.products
  for select
  to authenticated
  using (valid_until >= (now() at time zone 'Asia/Colombo')::date);

-- authenticated: may create products, always attributed to themselves.
create policy products_insert_own
  on public.products
  for insert
  to authenticated
  with check (created_by = auth.uid());

-- authenticated: may update only their own products, and may not reassign
-- ownership to someone else via the update.
create policy products_update_own
  on public.products
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- authenticated: may delete only their own products.
create policy products_delete_own
  on public.products
  for delete
  to authenticated
  using (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- categories — readable by anyone signed in (needed for the product form's
-- category dropdown and the AI schemas' enum), writable by no one via the
-- Data API. Category management, if ever needed, goes through a migration.
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
revoke all on public.categories from anon;

create policy categories_select_authenticated
  on public.categories
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- ai_usage — never exposed to the Data API at all. Only the API's
-- service_role client reads/writes it; RLS with zero policies plus a
-- blanket revoke ensures a client-side key can neither see nor forge quota
-- rows for another user.
-- ---------------------------------------------------------------------------
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
