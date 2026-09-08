import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Tracks rate-limit buckets by authenticated user id when available,
 * falling back to IP for unauthenticated requests. Requires
 * `app.set('trust proxy', 1)` in main.ts to be correct behind nginx — see
 * that file for why the hop count matters.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.id ?? req.ip;
  }
}
