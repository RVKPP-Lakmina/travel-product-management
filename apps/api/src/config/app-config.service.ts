import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema.js';

/**
 * The only place in the app allowed to read `process.env` (indirectly, via
 * Nest's ConfigService). Every other file gets a typed getter here instead
 * of scattering `process.env.X` reads across services — one place to see
 * the whole configuration surface, and one place that would need to change
 * if a key were renamed.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get corsOrigins(): string[] {
    return this.config.get('CORS_ORIGINS', { infer: true });
  }

  get supabaseUrl(): string {
    return this.config.get('SUPABASE_URL', { infer: true });
  }

  get supabaseServiceRoleKey(): string {
    return this.config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true });
  }

  get supabaseStorageBucket(): string {
    return this.config.get('SUPABASE_STORAGE_BUCKET', { infer: true });
  }

  get supabaseJwksUrl(): string {
    // Fetched over the network — must use the URL the API can actually
    // reach, i.e. SUPABASE_URL.
    return `${this.supabaseUrl}/auth/v1/.well-known/jwks.json`;
  }

  get supabaseIssuer(): string {
    // A string-equality check against the token's `iss` claim — must match
    // the URL the BROWSER signed in against, which is not always the one
    // the API reaches Supabase on (see SUPABASE_JWT_ISSUER).
    return (
      this.config.get('SUPABASE_JWT_ISSUER', { infer: true }) ?? `${this.supabaseUrl}/auth/v1`
    );
  }

  get openaiApiKey(): string {
    return this.config.get('OPENAI_API_KEY', { infer: true });
  }

  get openaiModelGeneration(): string {
    return this.config.get('OPENAI_MODEL_GENERATION', { infer: true });
  }

  get openaiModelSearch(): string {
    return this.config.get('OPENAI_MODEL_SEARCH', { infer: true });
  }

  get openaiModelImage(): string {
    return this.config.get('OPENAI_MODEL_IMAGE', { infer: true });
  }

  get aiDailyQuota(): number {
    return this.config.get('AI_DAILY_QUOTA', { infer: true });
  }

  get logLevel(): string {
    return this.config.get('LOG_LEVEL', { infer: true });
  }

  get aiLogPrompts(): boolean {
    return this.config.get('AI_LOG_PROMPTS', { infer: true });
  }
}
