import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureCors, configureHttpApp } from '../../src/app.setup.js';
import { AppConfigService } from '../../src/config/app-config.service.js';
import {
  buildCatalog,
  parseOverlay,
} from '../../src/modules/ingredients/importers/catalog.builder.js';
import { importCatalog } from '../../src/modules/ingredients/importers/catalog.importer.js';
import { parseTaxonomy } from '../../src/modules/ingredients/importers/taxonomy.parser.js';
import { ModelVersionStatus } from '../../src/modules/model-registry/constants/model-registry.constants.js';
import { parseClassesFile } from '../../src/modules/model-registry/importers/classes-file.parser.js';
import { importModelVersion } from '../../src/modules/model-registry/importers/model-version.importer.js';

export const TEST_MODEL_VERSION = 'yolov8n-ingredients-0.0.1-test';
export const RETIRED_MODEL_VERSION = 'yolov8n-ingredients-0.0.0-test';

const SEED_DATA_DIR = join(import.meta.dirname, '../../src/seeders/data');
const CLASSES_FIXTURE = join(import.meta.dirname, '../fixtures/classes.yaml');

export interface E2eAppOptions {
  /** Overrides CORS_ORIGINS from the test env, for the CORS suite. */
  readonly corsOrigins?: readonly string[];
}

export async function createE2eApp(
  options: E2eAppOptions = {},
): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  configureHttpApp(app);
  configureCors(
    app,
    options.corsOrigins ?? app.get(AppConfigService).corsOrigins,
  );
  await app.init();
  return app;
}

export interface TestSession {
  readonly userId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
}

interface SessionBody {
  user: { id: string };
  tokens: { accessToken: string; refreshToken: string };
}

export async function registerUser(
  server: Server,
  email: string,
  password = 'correct horse battery staple',
): Promise<TestSession> {
  const response = await request(server)
    .post('/api/v1/auth/register')
    .send({ email, password })
    .expect(201);
  const body = response.body as SessionBody;
  return {
    userId: body.user.id,
    accessToken: body.tokens.accessToken,
    refreshToken: body.tokens.refreshToken,
  };
}

// Drops every table in the test database and replays the migrations, so each suite starts clean.
export async function resetDatabase(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const { database } = dataSource.options;
  if (typeof database !== 'string' || !database.endsWith('_test')) {
    throw new Error(
      `Refusing to reset "${String(database)}": e2e only runs against a *_test database`,
    );
  }
  await dataSource.dropDatabase();
  await dataSource.runMigrations({ transaction: 'each' });
}

export async function seedCatalogAndRegistry(
  app: INestApplication,
): Promise<void> {
  const dataSource = app.get(DataSource);
  const taxonomy = parseTaxonomy(
    readFileSync(join(SEED_DATA_DIR, 'taxonomy.yaml'), 'utf8'),
  );
  const overlay = parseOverlay(
    JSON.parse(
      readFileSync(join(SEED_DATA_DIR, 'ingredient-overlay.json'), 'utf8'),
    ),
  );
  const rows = buildCatalog(taxonomy, overlay);
  await dataSource.transaction((manager) => importCatalog(manager, rows));

  const classesFile = readFileSync(CLASSES_FIXTURE);
  const classes = parseClassesFile(classesFile.toString('utf8'));
  const classesSha256 = createHash('sha256').update(classesFile).digest('hex');
  for (const [id, status] of [
    [TEST_MODEL_VERSION, ModelVersionStatus.SUPPORTED],
    [RETIRED_MODEL_VERSION, ModelVersionStatus.RETIRED],
  ] as const) {
    await dataSource.transaction((manager) =>
      importModelVersion(manager, {
        id,
        classes,
        classesSha256,
        taxonomyVersion: taxonomy.version,
        status,
      }),
    );
  }
}
