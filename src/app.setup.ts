import {
  type INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { GlobalExceptionFilter } from '@/commons/filters/global-exception.filter.js';

export const API_PREFIX = 'api';
export const DOCS_PATH = `${API_PREFIX}/docs`;

// Shared by main.ts and the e2e suite so the routes under test are the routes that ship.
export function configureHttpApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
}
