-- ============================================================================
-- 0006: Product AI provenance
--
-- Adds `products.ai_generated` so the UI can mark rows that started life as
-- an AI draft (the amber sparkle in the product list / dashboard). Before
-- this, "AI-ness" existed only in the transient POST /ai/generate-product
-- response and was lost the moment the draft was saved.
--
-- Trust model: this flag is set from the request body on create (it IS in
-- createProductSchema, unlike created_by). A client could therefore lie and
-- claim a hand-typed product was AI-generated, or vice versa. That is
-- acceptable — it is a cosmetic provenance hint, not an authorization or
-- billing signal, and the honest client (our own form) is the only caller.
-- Documented here and in packages/validation/src/product.schema.ts so a
-- future reader doesn't mistake the openness for an oversight.
--
-- Not nullable, defaults false: every existing row is "not AI" and the
-- column never needs a tri-state.
-- ============================================================================

alter table public.products
  add column ai_generated boolean not null default false;

comment on column public.products.ai_generated is
  'Cosmetic provenance hint — true when the product was created from an AI '
  'draft. Set from the request body on create; intentionally client-'
  'settable (not an auth/billing signal). See product.schema.ts.';

-- products_listable is `select *`, which was expanded to an explicit column
-- list when the view was created in 0003 — it will NOT pick up the new
-- column until recreated. CREATE OR REPLACE VIEW permits appending columns
-- to the end of the select list, which is exactly what re-expanding `*`
-- does here. The WHERE clause and security_invoker setting are unchanged.
create or replace view public.products_listable
  with (security_invoker = true)
as
select *
from public.products
where valid_until >= (now() at time zone 'Asia/Colombo')::date;
