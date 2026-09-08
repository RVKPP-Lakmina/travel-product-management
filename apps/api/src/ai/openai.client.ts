import { Global, Module } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfigService } from '../config/app-config.service.js';

export const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');

/**
 * The ONE OpenAI client in the process, built once at boot. `maxRetries: 1`
 * relies on the SDK's own built-in retry predicate — it already retries
 * only on 408/409/429/5xx and network errors with jittered backoff, which
 * is exactly the "retry only transient failures" policy called for. A
 * schema-validation failure happens after this call returns, so it is
 * never retried by the SDK — the caller decides what to do (fall back,
 * for search; surface an error, for generation) rather than spending a
 * second paid call on an input that will likely fail identically again.
 *
 * Per-call timeouts (15s generation / 8s search / 45s image) are passed as
 * a per-request `timeout`/`signal` option by each caller, not set globally
 * here — the three AI operations have very different latency profiles.
 */
@Global()
@Module({
  providers: [
    {
      provide: OPENAI_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new OpenAI({
          apiKey: config.openaiApiKey,
          maxRetries: 1,
        }),
    },
  ],
  exports: [OPENAI_CLIENT],
})
export class OpenAiClientModule {}
