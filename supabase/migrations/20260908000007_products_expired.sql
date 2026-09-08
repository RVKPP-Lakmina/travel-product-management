-- ============================================================================
-- 0007: products_expired — a read path for the rows products_listable hides
--
-- Problem: expired products (valid_until < today) are excluded from every
-- listing/search/export by products_listable (0003). That is correct for
-- those surfaces, but it also means a user has NO way to find an expired
-- product in order to renew its dates — even though the dashboard counts
-- them and GET /products/:id can open one if you already know its id.
--
-- Why a second view instead of a flag on the existing read path:
-- query-compiler.ts is deliberately built so it "has no way to accidentally
-- read the base table" — the AI search compiler cannot forget the validity
-- filter because it was never given a table containing expired rows. Adding
-- an `includeExpired` parameter there would hand it exactly that footgun.
-- This view is a separate, narrow path the AI flow never touches: it is
-- read only by ProductsService.findExpired(), behind GET /products/expired.
--
-- Mirrors products_listable exactly: `select *`, security_invoker = true,
-- same Asia/Colombo "today", just the complementary predicate. valid_until
-- is inclusive there, so strictly `< today` here — a product is not expired
-- on its valid_until day itself.
-- ============================================================================

create view public.products_expired
  with (security_invoker = true)
as
select *
from public.products
where valid_until < (now() at time zone 'Asia/Colombo')::date;

comment on view public.products_expired is
  'Complement of products_listable: rows with valid_until < today '
  '(Asia/Colombo). Read only by GET /products/expired so users can find and '
  'renew lapsed products. Never referenced by the AI search compiler.';
