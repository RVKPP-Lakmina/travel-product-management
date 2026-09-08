import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opt a route (or whole controller) OUT of the global auth guard. The guard
 * is registered as a default-deny APP_GUARD — every route requires a valid
 * Supabase JWT unless explicitly marked @Public(). Use this ONLY for
 * /health and /health/ready; a route quietly forgetting @UseGuards() is how
 * endpoints get left open by accident, which is exactly what default-deny
 * is meant to prevent — don't reach for this decorator to work around that.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
