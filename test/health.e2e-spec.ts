import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createE2eApp } from './support/e2e-app.js';

interface HealthResponseBody {
  status: string;
  db: string;
  timestamp: string;
}

// Needs the local Postgres test database (README.md § e2e's separate database).
describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health is public and version-neutral', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/health')
      .expect(200);
    const body = response.body as HealthResponseBody;

    expect(body).toMatchObject({ status: 'ok', db: 'ok' });
    expect(typeof body.timestamp).toBe('string');
  });

  it('serves nothing outside the /api prefix', async () => {
    await request(app.getHttpServer() as Server)
      .get('/health')
      .expect(404);
  });
});
