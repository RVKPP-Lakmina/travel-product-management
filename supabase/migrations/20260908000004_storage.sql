-- ============================================================================
-- 0004: Storage bucket for AI-generated product images
--
-- Design: public read (images are non-sensitive marketing assets and public
-- URLs are CDN-cacheable — simpler than a private bucket + signed-URL
-- refresh dance for this use case), writes restricted to service_role only.
-- Since service_role bypasses RLS, the API can still upload; the browser,
-- holding only the publishable key, never can. Object keys are always
-- server-generated (products/{productId}/{randomUUID()}.webp) — no
-- user-controlled path segment ever reaches a storage key, which forecloses
-- path traversal into the bucket.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB, matches the API's own post-decode size assertion
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do nothing;

-- Public read for everyone (anon included) — this is the intended exception
-- to "no anon policy" used elsewhere in this schema, because product photos
-- are meant to be publicly viewable in the storefront.
create policy product_images_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'product-images');

-- Deliberately NO insert/update/delete policy for any role (anon or
-- authenticated). service_role bypasses RLS entirely, so the API's
-- image-generation endpoint can still write; no client-held key can.
