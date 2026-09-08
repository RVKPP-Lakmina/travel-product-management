import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AppConfigModule } from './config/config.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { SupabaseModule } from './common/supabase/supabase.module.js';
import { SupabaseAuthGuard } from './common/guards/supabase-auth.guard.js';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { HealthModule } from './health/health.module.js';
import { ProductsModule } from './products/products.module.js';

const REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Module({
  imports: [
    AppConfigModule,
    SupabaseModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.logLevel,
          transport: config.isProduction ? undefined : { target: 'pino-pretty' },
          // Never let an inbound header dictate the id used to correlate
          // logs unless it's actually a UUID — an unvalidated header would
          // otherwise flow straight into every log line for the request.
          genReqId: (req: any, res: any) => {
            const inbound = req.headers['x-request-id'];
            const id = typeof inbound === 'string' && REQUEST_ID_RE.test(inbound) ? inbound : randomUUID();
            res.setHeader('X-Request-Id', id);
            return id;
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["x-api-key"]',
              '*.password',
              '*.token',
              '*.apiKey',
              '*.prompt',
              '*.description',
              'res.headers["set-cookie"]',
            ],
            censor: '[REDACTED]',
          },
        },
      }),
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
      // Named but not yet applied to any controller — Phase 3's AI
      // endpoints will opt into these with @Throttle({ ai: {...} }).
      { name: 'ai', ttl: 60_000, limit: 10 },
      { name: 'image', ttl: 300_000, limit: 5 },
    ]),
    HealthModule,
    ProductsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Order matters: the auth guard runs first and attaches req.user,
    // which the throttler guard's custom getTracker then reads.
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
