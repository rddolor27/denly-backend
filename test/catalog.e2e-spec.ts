import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createE2eApp,
  RETIRED_MODEL_VERSION,
  resetDatabase,
  seedCatalogAndRegistry,
  TEST_MODEL_VERSION,
} from './support/e2e-app.js';

interface IngredientBody {
  slug: string;
  canonicalName: string;
  category: string;
  allergens: string[];
  aliases?: { alias: string; source: string; locale: string | null }[];
}

interface IngredientPageBody {
  items: IngredientBody[];
  total: number;
}

interface ModelVersionBody {
  id: string;
  status: string;
  classCount: number;
  classes?: { classId: number; className: string }[];
}

interface ErrorBody {
  code: string;
}

describe('Ingredients and model registry (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    app = await createE2eApp();
    server = app.getHttpServer() as Server;
    await resetDatabase(app);
    await seedCatalogAndRegistry(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('seeds one ingredient per taxonomy class', async () => {
    const response = await request(server)
      .get('/api/v1/ingredients?limit=1')
      .expect(200);

    expect((response.body as IngredientPageBody).total).toBe(100);
  });

  it('finds an ingredient by a regional alias prefix', async () => {
    const response = await request(server)
      .get('/api/v1/ingredients?q=kamat')
      .expect(200);
    const body = response.body as IngredientPageBody;

    expect(body.items.map((item) => item.slug)).toEqual(['tomato']);
  });

  it('filters by category', async () => {
    const response = await request(server)
      .get('/api/v1/ingredients?category=meat')
      .expect(200);
    const body = response.body as IngredientPageBody;

    expect(body.items.map((item) => item.slug).sort()).toEqual([
      'beef_raw',
      'chicken_raw',
      'pork_raw',
    ]);
  });

  it('returns an ingredient with its aliases and allergens', async () => {
    const response = await request(server)
      .get('/api/v1/ingredients/shrimp')
      .expect(200);
    const body = response.body as IngredientBody;

    expect(body.allergens).toEqual(['crustacean_shellfish']);
    expect(body.aliases).toContainEqual({
      alias: 'shrimp',
      source: 'model_class',
      locale: null,
    });
    expect(body.aliases).toContainEqual({
      alias: 'hipon',
      source: 'regional',
      locale: 'tl',
    });
  });

  it('returns INGREDIENT_NOT_FOUND for an unknown slug', async () => {
    const response = await request(server)
      .get('/api/v1/ingredients/unicorn')
      .expect(404);

    expect((response.body as ErrorBody).code).toBe('INGREDIENT_NOT_FOUND');
  });

  it('lists registered model versions with their status', async () => {
    const response = await request(server)
      .get('/api/v1/model-versions')
      .expect(200);
    const body = response.body as ModelVersionBody[];

    expect(
      body.map(({ id, status, classCount }) => ({ id, status, classCount })),
    ).toEqual(
      expect.arrayContaining([
        { id: TEST_MODEL_VERSION, status: 'supported', classCount: 6 },
        { id: RETIRED_MODEL_VERSION, status: 'retired', classCount: 6 },
      ]),
    );
  });

  it('returns a model version with its classes ordered by id', async () => {
    const response = await request(server)
      .get(`/api/v1/model-versions/${TEST_MODEL_VERSION}`)
      .expect(200);
    const body = response.body as ModelVersionBody;

    expect(body.classes?.map((c) => c.classId)).toEqual([0, 1, 3, 51, 61, 67]);
  });

  it('returns MODEL_VERSION_NOT_FOUND for an unknown version', async () => {
    const response = await request(server)
      .get('/api/v1/model-versions/yolov8n-ingredients-9.9.9')
      .expect(404);

    expect((response.body as ErrorBody).code).toBe('MODEL_VERSION_NOT_FOUND');
  });
});
