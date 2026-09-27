import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { configureHttpApp, DOCS_PATH } from './app.setup.js';
import { AppConfigService } from '@/config/app-config.service.js';

const BODY_SIZE_LIMIT = '1mb';

async function bootstrap(): Promise<void> {
  // 1. Logger + process-level safety net — an uncaught error must never crash silently.
  const logger = new Logger('Bootstrap');
  process.on('uncaughtException', (error) =>
    logger.error('[uncaughtException]', error.stack),
  );
  process.on('unhandledRejection', (reason) =>
    logger.error('[unhandledRejection]', String(reason)),
  );

  // bodyParser: false because step 5 installs express's json/urlencoded parsers itself, with
  // explicit size limits instead of Nest's unbounded default.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const config = app.get(AppConfigService);

  // 2. `/api` prefix, URI versioning (default v1), global filter and ValidationPipe.
  configureHttpApp(app);

  // 3. Swagger at /api/docs, non-production only — its output is also the mobile contract.
  if (!config.isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Denly API')
        .setDescription('HTTP API consumed by denly-mobile')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(DOCS_PATH, app, document);
  }

  // 4. Security headers.
  app.use(helmet());

  // 5. Body parsers with explicit limits (no image uploads in v1 — architecture-rules.md).
  app.use(json({ limit: BODY_SIZE_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));

  // 6. CORS — deferred. When implemented: a dynamic origin callback reading CORS_ORIGINS,
  //    allowing the empty origin (mobile apps send none).

  // 7. Shutdown hooks (SIGTERM/SIGINT -> onModuleDestroy, e.g. closing the DB pool cleanly).
  app.enableShutdownHooks();

  // 8. Throttler tiers — deferred.

  await app.listen(config.port);
  logger.log(`[bootstrap] listening on port ${config.port}`);
}

void bootstrap();
