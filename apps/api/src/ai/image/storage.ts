import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB — matches the bucket's file_size_limit (0004_storage.sql)

// Magic-byte signatures for the formats the bucket's allowed_mime_types
// accepts. Checked BEFORE upload — never trust a model-returned byte
// stream's claimed format.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function isPng(buf: Buffer): boolean {
  return PNG_SIGNATURE.every((byte, i) => buf[i] === byte);
}
function isWebp(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  );
}

export class InvalidImageBytesError extends Error {
  constructor(reason: string) {
    super(`Generated image bytes were rejected: ${reason}`);
    this.name = 'InvalidImageBytesError';
  }
}

/**
 * Decodes and validates base64 image bytes, then uploads to the
 * `product-images` bucket. The storage key is ENTIRELY server-generated
 * (`products/{productId}/{randomUUID()}.webp`) — no request-derived or
 * user-controlled path segment ever reaches a storage key, which forecloses
 * path traversal into the bucket by construction, not by sanitization.
 *
 * Upload uses the service-role client (bucket write policy grants no role
 * at all — see 0004_storage.sql — so only this path can ever write here).
 */
export async function uploadProductImage(
  supabase: SupabaseClient,
  bucket: string,
  productId: string,
  base64: string,
): Promise<string> {
  const bytes = Buffer.from(base64, 'base64');

  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new InvalidImageBytesError(`size ${bytes.length} bytes out of bounds`);
  }
  if (!isPng(bytes) && !isWebp(bytes)) {
    throw new InvalidImageBytesError('unrecognized image format (expected PNG or WebP magic bytes)');
  }

  const contentType = isWebp(bytes) ? 'image/webp' : 'image/png';
  const extension = isWebp(bytes) ? 'webp' : 'png';
  const key = `products/${productId}/${randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(bucket).upload(key, bytes, {
    contentType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(key);
  return data.publicUrl;
}
