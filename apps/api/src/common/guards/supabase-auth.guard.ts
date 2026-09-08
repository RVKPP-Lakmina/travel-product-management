import {
  Injectable,
  CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AppConfigService } from '../../config/app-config.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifies the Supabase-issued JWT LOCALLY against Supabase's JWKS endpoint
 * — asymmetric verification, not the legacy shared HS256 secret.
 *
 * Why not the shared secret: a symmetric key that can verify a token can
 * also MINT one. Holding it in the API's env would mean a leak of this
 * service's config compromises every user's identity, and the secret can't
 * be rotated without downtime. Asymmetric verification means this service
 * holds no signing capability at all — it can only check, never forge.
 *
 * Why not `supabase.auth.getUser(token)`: that's a network round-trip to
 * Supabase on every single authenticated request. `createRemoteJWKSet`
 * caches the public keys (with rotation/cooldown handling built in), so
 * verification after the first request is entirely local and fast.
 *
 * Registered globally as APP_GUARD — default-deny. Every route requires a
 * valid token unless explicitly marked @Public().
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly jwks: JWTVerifyGetKey;
  private readonly issuer: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: AppConfigService,
  ) {
    // Constructed once per process (Nest providers are singletons by
    // default) so the underlying key cache in `jose` is actually shared
    // across requests — this is what makes verification fast after the
    // first call.
    this.jwks = createRemoteJWKSet(new URL(this.config.supabaseJwksUrl));
    this.issuer = this.config.supabaseIssuer;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload;
    try {
      const result = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: 'authenticated',
        // Explicit allowlist — omitting this is how `alg: none` /
        // algorithm-confusion attacks land. Supabase signs with ES256;
        // RS256 is accepted too for older/self-hosted Supabase projects.
        algorithms: ['ES256', 'RS256'],
        clockTolerance: 5,
      });
      payload = result.payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Reject anything that isn't a normal end-user session. In particular,
    // defensively reject a `service_role` token even though no legitimate
    // client should ever hold or send one — belt and suspenders.
    if (payload.role !== 'authenticated') {
      throw new UnauthorizedException('Token is not an authenticated user session');
    }

    const sub = payload.sub;
    if (!sub || !UUID_RE.test(sub)) {
      throw new UnauthorizedException('Token subject is not a valid user id');
    }

    const user: AuthenticatedUser = {
      id: sub,
      email: typeof payload.email === 'string' ? payload.email : null,
    };
    req.user = user;
    return true;
  }
}

function extractBearerToken(authorizationHeader: unknown): string | null {
  if (typeof authorizationHeader !== 'string') return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}
