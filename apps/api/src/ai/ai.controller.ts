import {
  BadGatewayException,
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { aiGenerateProductRequestSchema, aiSearchRequestSchema } from '@travel/validation';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/guards/supabase-auth.guard.js';
import { GenerateService, AiGenerationFailedError } from './generation/generate.service.js';
import { SearchService } from './search/search.service.js';
import { ImageService, AiImageFailedError, AiImageRejectedError } from './image/image.service.js';
import { AiUsageService, AiQuotaExceededError } from './ai-usage.service.js';

/**
 * Every route here follows the same invariant, stated once: MODEL OUTPUT
 * NEVER BECOMES EXECUTABLE TEXT. Not SQL, not a PostgREST filter string,
 * not a shell argument, not a file path, not a URL this server fetches,
 * not a redirect target, not HTML rendered unescaped. Generation output
 * only ever populates a form the user reviews before an ordinary, fully
 * re-validated POST /products. Search output only ever becomes a
 * SearchFilter compiled by products/query-compiler.ts's fixed set of
 * .eq()/.in()/.textSearch() calls. Image generation only ever produces
 * bytes decoded and validated by ai/image/storage.ts, uploaded under a
 * server-generated key. If a change to this file would violate that
 * invariant, it's the wrong change.
 *
 * No prefix on @Controller() — each route below states its full path so
 * the image route can live at /api/products/:id/image (matching the
 * Products resource in the URL) without AiModule needing to import
 * ProductsModule's controller or vice versa in a cycle.
 */
@Controller()
export class AiController {
  constructor(
    private readonly generateService: GenerateService,
    private readonly searchService: SearchService,
    private readonly imageService: ImageService,
    private readonly aiUsage: AiUsageService,
  ) {}

  // @nestjs/throttler applies EVERY registered named bucket (default, ai,
  // image) to a route by default — @Throttle only overrides the limits for
  // the bucket(s) it names, it does not scope the route to just those.
  // Without the @SkipThrottle below, this route would ALSO be governed by
  // the unrelated `image` bucket's much tighter 5-per-300s limit, which is
  // exactly the bug an end-to-end boot test against this endpoint caught
  // (the 5th call 429'd instead of the 11th).
  @Post('ai/generate-product')
  @Throttle({ ai: { limit: 10, ttl: 60_000 } })
  @SkipThrottle({ image: true })
  async generateProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(aiGenerateProductRequestSchema)) body: { prompt: string },
  ) {
    await this.assertQuota(user.id);
    try {
      // GenerateService records its own usage once the real token counts
      // from the completion are known — see generate.service.ts.
      return await this.generateService.generate(user.id, body.prompt);
    } catch (err) {
      if (err instanceof AiGenerationFailedError) {
        throw new BadGatewayException({ code: 'AI_GENERATION_FAILED', message: 'Product generation failed' });
      }
      throw err;
    }
  }

  @Post('ai/search')
  @Throttle({ ai: { limit: 10, ttl: 60_000 } })
  @SkipThrottle({ image: true })
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(aiSearchRequestSchema)) body: { query: string },
  ) {
    await this.assertQuota(user.id);
    // Search never throws on an AI outage — SearchService degrades to the
    // heuristic fallback internally (search/heuristic-fallback.ts) and
    // still returns a normal 200. There is no error branch to catch here
    // for that case; only genuinely unexpected failures propagate.
    return this.searchService.search(user.id, body.query);
  }

  @Post('products/:id/image')
  @Throttle({ image: { limit: 5, ttl: 300_000 } })
  @SkipThrottle({ ai: true })
  async generateImage(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.assertQuota(user.id);
    try {
      const result = await this.imageService.generateForProduct(id, user.id);
      // gpt-image-1 is billed per-image, not per-token — recorded as one
      // call with no token estimate rather than a fabricated number.
      await this.recordUsage(user.id, 0);
      return result;
    } catch (err) {
      if (err instanceof AiImageRejectedError) {
        throw new UnprocessableEntityException({ code: 'AI_IMAGE_REJECTED', message: err.message });
      }
      if (err instanceof AiImageFailedError) {
        throw new BadGatewayException({ code: 'AI_IMAGE_FAILED', message: 'Image generation failed' });
      }
      throw err;
    }
  }

  private async assertQuota(userId: string): Promise<void> {
    try {
      await this.aiUsage.assertWithinQuota(userId);
    } catch (err) {
      if (err instanceof AiQuotaExceededError) {
        throw new HttpException(
          { code: 'AI_QUOTA_EXCEEDED', message: err.message },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw err;
    }
  }

  private async recordUsage(userId: string, estimatedTokens: number): Promise<void> {
    // Usage bookkeeping failing should never fail an otherwise-successful
    // AI response to the caller — log and move on. The quota CHECK before
    // the call is the actual enforcement; this is just the ledger.
    try {
      await this.aiUsage.recordUsage(userId, estimatedTokens);
    } catch {
      // Swallowed intentionally — see comment above.
    }
  }
}
