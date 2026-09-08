import { z } from 'zod';

/**
 * Boot-time environment contract. `ConfigModule.forRoot({ validate })` runs
 * this against raw `process.env` before anything else in the app starts —
 * fail fast on a misconfigured deploy rather than discovering a missing key
 * three requests in.
 *
 * IMPORTANT: never log the raw parse error's `.issues[].received` value on
 * failure — that would print the actual secret that failed to validate. See
 * `validateEnv()` below, which surfaces only issue *paths* (key names).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // Comma-separated allowlist. Never '*', never a regex, never `true`.
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),

  // ── Supabase (server-only) ──
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default('product-images'),
  // The `iss` claim to require on user JWTs. Defaults to
  // `${SUPABASE_URL}/auth/v1`. Only needs setting when the URL the API uses
  // to REACH Supabase differs from the URL the BROWSER used to sign in —
  // e.g. Docker, where the API talks to host.docker.internal:54321 but the
  // token was minted with iss=http://127.0.0.1:54321/auth/v1. An empty
  // value (a bare `SUPABASE_JWT_ISSUER=` in an env file) is treated as unset.
  SUPABASE_JWT_ISSUER: z
    .preprocess((v) => (v === '' ? undefined : v), z.url().optional()),

  // ── OpenAI (server-only, used from Phase 3 onward) ──
  OPENAI_API_KEY: z.string().min(10),
  OPENAI_MODEL_GENERATION: z.string().min(1).default('gpt-4.1-mini'),
  OPENAI_MODEL_SEARCH: z.string().min(1).default('gpt-4.1-mini'),
  OPENAI_MODEL_IMAGE: z.string().min(1).default('gpt-image-1'),

  AI_DAILY_QUOTA: z.coerce.number().int().positive().default(200),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // z.coerce.boolean() is a trap here: any non-empty string (including the
  // literal string "false") coerces to `true`. An explicit enum + transform
  // is the only safe way to parse a boolean-shaped env var.
  AI_LOG_PROMPTS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    // Only ever surface issue PATHS (key names), never `.received` values —
    // the values are exactly the secrets this validation exists to protect.
    const missingOrInvalid = result.error.issues.map((issue) => issue.path.join('.'));
    throw new Error(
      `Invalid environment configuration. Missing or invalid keys: ${missingOrInvalid.join(', ')}. ` +
        `See apps/api/.env.example.`,
    );
  }
  return result.data;
}
