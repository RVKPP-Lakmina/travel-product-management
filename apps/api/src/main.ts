import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import express from 'express';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/app-config.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(AppConfigService);

  // Mandatory behind nginx. Without this, every request appears to
  // originate from the proxy's IP, which breaks both the throttler's
  // per-client tracking and req.ip generally. `1` = trust exactly one hop
  // (the reverse proxy) — NOT `true`, which would trust an arbitrary,
  // client-spoofable X-Forwarded-For chain.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // A JSON API needs nothing rendered — deny everything by default.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: { maxAge: 63_072_000, includeSubDomains: true },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.disable('x-powered-by');

  app.enableCors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    credentials: false,
    maxAge: 86_400,
  });

  // Explicit body size cap. Nest's default is already 100kb via
  // body-parser, but stating it here means a future `bodyParser: false`
  // on NestFactory.create can't silently remove the limit.
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ limit: '100kb', extended: false }));

  app.setGlobalPrefix('api');

  // URI versioning: every route is served under /api/v1/* by default.
  // A future breaking change ships as v2 alongside v1 rather than mutating
  // the existing contract under clients. Health/readiness probes opt out
  // (VERSION_NEUTRAL in HealthController) so orchestrators keep a stable
  // /api/health path across versions.
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.enableShutdownHooks();

  await app.listen(config.port);
}
await bootstrap();
