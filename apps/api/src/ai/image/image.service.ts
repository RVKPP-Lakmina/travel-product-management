import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type OpenAI from 'openai';
import { OPENAI_CLIENT } from '../openai.client.js';
import { SUPABASE_CLIENT } from '../../common/supabase/supabase.constants.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { CATEGORY_LABELS, type CategorySlug } from '@travel/validation';
import { sanitize } from '../sanitize.js';
import { uploadProductImage, InvalidImageBytesError } from './storage.js';

const FIELD_MAX_CHARS = 80;
const IMAGE_TIMEOUT_MS = 45_000;

export class AiImageFailedError extends Error {
  constructor(reason: string) {
    super(`Image generation failed: ${reason}`);
    this.name = 'AiImageFailedError';
  }
}

export class AiImageRejectedError extends Error {
  constructor() {
    super('The image request was rejected by the content moderation system');
    this.name = 'AiImageRejectedError';
  }
}

interface ProductImageSource {
  name: string;
  category: CategorySlug;
  destination: string;
}

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: AppConfigService,
  ) {}

  async generateForProduct(productId: string, userId: string): Promise<{ imageUrl: string }> {
    const product = await this.loadOwnedProduct(productId, userId);
    const prompt = this.buildPrompt(product);

    let base64: string;
    try {
      const result = await this.openai.images.generate(
        {
          model: this.config.openaiModelImage,
          prompt,
          size: '1024x1024',
          quality: 'low',
          n: 1,
          output_format: 'webp',
          moderation: 'low',
        },
        { timeout: IMAGE_TIMEOUT_MS },
      );

      const b64 = result.data?.[0]?.b64_json;
      if (!b64) {
        throw new AiImageFailedError('no image data returned');
      }
      base64 = b64;
    } catch (err) {
      if (err instanceof AiImageFailedError) throw err;
      if (isContentPolicyError(err)) {
        // Deliberately do not echo the provider's own rejection text back
        // to the caller — if the rejection was triggered by injected or
        // adversarial content, echoing it could reflect that content back
        // to whoever reads the response.
        this.logger.warn(`content-policy rejection generating image for product ${productId}`);
        throw new AiImageRejectedError();
      }
      this.logger.warn(
        `image generation call failed for product ${productId}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      throw new AiImageFailedError('the model call failed or timed out');
    }

    let imageUrl: string;
    try {
      imageUrl = await uploadProductImage(this.supabase, this.config.supabaseStorageBucket, productId, base64);
    } catch (err) {
      if (err instanceof InvalidImageBytesError) {
        this.logger.warn(`${err.message} (product ${productId})`);
        throw new AiImageFailedError('the generated image failed validation');
      }
      throw err;
    }

    // Write image_url onto the row, re-applying the ownership predicate —
    // consistent with every other mutation in ProductsService, even though
    // ownership was already checked in loadOwnedProduct() above.
    const { data, error } = await this.supabase
      .from('products')
      .update({ image_url: imageUrl })
      .eq('id', productId)
      .eq('created_by', userId)
      .select('id')
      .maybeSingle();

    if (error || !data) {
      // Compensating action: don't leave an orphaned object in storage if
      // the row update didn't stick.
      await this.deleteUploadedObject(imageUrl).catch(() => undefined);
      if (error) throw error;
      throw new NotFoundException('Product not found');
    }

    return { imageUrl };
  }

  private async loadOwnedProduct(productId: string, userId: string): Promise<ProductImageSource> {
    const { data, error } = await this.supabase
      .from('products')
      .select('name, category, destination')
      .eq('id', productId)
      .eq('created_by', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Product not found');
    return data as ProductImageSource;
  }

  /**
   * Built from STRUCTURED FIELDS ONLY — name, category label, destination —
   * plus a fixed style suffix. The free-text `description` is deliberately
   * excluded: it's user/AI-authored and is the classic second-order
   * prompt-injection vector (it also tends to produce worse images than a
   * clean, structured prompt).
   */
  private buildPrompt(product: ProductImageSource): string {
    const name = sanitize(product.name, FIELD_MAX_CHARS);
    const categoryLabel = sanitize(CATEGORY_LABELS[product.category] ?? product.category, FIELD_MAX_CHARS);
    const destination = sanitize(product.destination, FIELD_MAX_CHARS);

    return (
      `Professional travel marketing photograph of ${name}, a ${categoryLabel} experience in ${destination}, ` +
      `Sri Lanka. Bright natural lighting, no text, no watermark, no people's faces.`
    );
  }

  private async deleteUploadedObject(publicUrl: string): Promise<void> {
    const bucket = this.config.supabaseStorageBucket;
    const marker = `/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const key = publicUrl.slice(idx + marker.length);
    await this.supabase.storage.from(bucket).remove([key]);
  }
}

const CONTENT_POLICY_CODES = new Set(['content_policy_violation', 'moderation_blocked', 'image_generation_user_error']);

function isContentPolicyError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const withCode = err as { code?: string; error?: { code?: string } };
  const code = withCode.code ?? withCode.error?.code;
  return typeof code === 'string' && CONTENT_POLICY_CODES.has(code);
}
