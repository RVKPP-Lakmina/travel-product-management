import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ImageService, AiImageFailedError, AiImageRejectedError } from './image.service.js';
import type { AppConfigService } from '../../config/app-config.service.js';

function makeConfig(): AppConfigService {
  return { openaiModelImage: 'gpt-image-1', supabaseStorageBucket: 'product-images' } as unknown as AppConfigService;
}

// A 1x1 transparent PNG, base64-encoded — real magic bytes so
// storage.ts's format check passes.
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function makeSupabase(opts: {
  ownedProduct?: { name: string; category: string; destination: string } | null;
  uploadError?: unknown;
  updateFails?: boolean;
}) {
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: opts.ownedProduct ?? null,
      error: null,
    }),
  };
  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(
      opts.updateFails ? { data: null, error: null } : { data: { id: 'product-1' }, error: null },
    ),
  };

  const from = vi.fn((table: string) => {
    if (table === 'products') {
      return {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn().mockReturnValue(updateChain),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });

  const remove = vi.fn().mockResolvedValue({ error: null });
  const storage = {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: opts.uploadError ?? null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/product-images/products/product-1/abc.png' },
      }),
      remove,
    }),
  };

  return { from, storage, __remove: remove } as any;
}

describe('ImageService', () => {
  const OWNED_PRODUCT = { name: 'Dinner Buffet', category: 'dining', destination: 'Colombo' };

  it('generates, uploads, and writes image_url onto the owned product', async () => {
    const generate = vi.fn().mockResolvedValue({ data: [{ b64_json: TINY_PNG_B64 }] });
    const openai = { images: { generate } } as any;
    const supabase = makeSupabase({ ownedProduct: OWNED_PRODUCT });
    const service = new ImageService(openai, supabase, makeConfig());

    const result = await service.generateForProduct('product-1', 'user-1');
    expect(result.imageUrl).toContain('product-images');
  });

  it('builds the image prompt from structured fields only — never includes free-text description', async () => {
    const generate = vi.fn().mockResolvedValue({ data: [{ b64_json: TINY_PNG_B64 }] });
    const openai = { images: { generate } } as any;
    const supabase = makeSupabase({ ownedProduct: OWNED_PRODUCT });
    const service = new ImageService(openai, supabase, makeConfig());

    await service.generateForProduct('product-1', 'user-1');
    const promptArg = generate.mock.calls[0][0].prompt;
    expect(promptArg).toContain('Dinner Buffet');
    expect(promptArg).toContain('Colombo');
    // Structured-fields-only means no product "description" text — the
    // ProductImageSource type loaded by loadOwnedProduct doesn't even
    // select a description column, so there is nothing to leak here even
    // if a caller tried.
  });

  it('throws NotFoundException for a product the caller does not own (ownership-scoped read)', async () => {
    const openai = { images: { generate: vi.fn() } } as any;
    const supabase = makeSupabase({ ownedProduct: null });
    const service = new ImageService(openai, supabase, makeConfig());

    await expect(service.generateForProduct('product-1', 'not-the-owner')).rejects.toBeInstanceOf(NotFoundException);
    expect(openai.images.generate).not.toHaveBeenCalled();
  });

  it('maps a content-policy rejection to AiImageRejectedError without echoing the rejection reason', async () => {
    const generate = vi.fn().mockRejectedValue({ code: 'content_policy_violation', message: 'depicts something bad' });
    const openai = { images: { generate } } as any;
    const supabase = makeSupabase({ ownedProduct: OWNED_PRODUCT });
    const service = new ImageService(openai, supabase, makeConfig());

    try {
      await service.generateForProduct('product-1', 'user-1');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AiImageRejectedError);
      expect(String(err)).not.toContain('depicts something bad');
    }
  });

  it('maps a timeout/generic failure to AiImageFailedError', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('Request timed out'));
    const openai = { images: { generate } } as any;
    const supabase = makeSupabase({ ownedProduct: OWNED_PRODUCT });
    const service = new ImageService(openai, supabase, makeConfig());

    await expect(service.generateForProduct('product-1', 'user-1')).rejects.toBeInstanceOf(AiImageFailedError);
  });

  it('rejects an empty/no-data response as AiImageFailedError', async () => {
    const generate = vi.fn().mockResolvedValue({ data: [] });
    const openai = { images: { generate } } as any;
    const supabase = makeSupabase({ ownedProduct: OWNED_PRODUCT });
    const service = new ImageService(openai, supabase, makeConfig());

    await expect(service.generateForProduct('product-1', 'user-1')).rejects.toBeInstanceOf(AiImageFailedError);
  });

  it('cleans up the uploaded storage object if the row update does not stick (compensating action)', async () => {
    const generate = vi.fn().mockResolvedValue({ data: [{ b64_json: TINY_PNG_B64 }] });
    const openai = { images: { generate } } as any;
    const supabase = makeSupabase({ ownedProduct: OWNED_PRODUCT, updateFails: true });
    const service = new ImageService(openai, supabase, makeConfig());

    await expect(service.generateForProduct('product-1', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(supabase.__remove).toHaveBeenCalled();
  });

  it('rejects invalid image bytes (bad magic number) before ever uploading', async () => {
    const generate = vi.fn().mockResolvedValue({ data: [{ b64_json: Buffer.from('not an image').toString('base64') }] });
    const openai = { images: { generate } } as any;
    const supabase = makeSupabase({ ownedProduct: OWNED_PRODUCT });
    const service = new ImageService(openai, supabase, makeConfig());

    await expect(service.generateForProduct('product-1', 'user-1')).rejects.toBeInstanceOf(AiImageFailedError);
  });
});
