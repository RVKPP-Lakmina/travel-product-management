import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../guards/supabase-auth.guard.js';

/**
 * The authenticated user, as attached by SupabaseAuthGuard. Never read a
 * user id from the request body, a query param, or a header — this
 * decorator is the ONLY sanctioned way a handler learns who is calling it.
 */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});
