import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createE2eApp } from './support/e2e-app.js';

const ALLOWED_ORIGIN = 'http://localhost:8081';

// Needs the local Postgres test database (README.md § e2e's separate database) for /api/health.
describe('CORS (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    app = await createE2eApp({ corsOrigins: [ALLOWED_ORIGIN] });
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers a preflight from a listed origin', async () => {
    const response = await request(server)
      .options('/api/v1/scans')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(
      ALLOWED_ORIGIN,
    );
    expect(response.headers['access-control-allow-methods']).toBe(
      'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    );
    expect(response.headers['access-control-allow-headers']).toBe(
      'Authorization,Content-Type,x-request-id',
    );
    expect(response.headers['access-control-max-age']).toBe('600');
    expect(
      response.headers['access-control-allow-credentials'],
    ).toBeUndefined();
  });

  it('exposes x-request-id to a listed origin', async () => {
    const response = await request(server)
      .get('/api/health')
      .set('Origin', ALLOWED_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(
      ALLOWED_ORIGIN,
    );
    expect(response.headers['access-control-expose-headers']).toBe(
      'x-request-id',
    );
  });

  it('serves an unlisted origin normally but without CORS headers', async () => {
    const response = await request(server)
      .get('/api/health')
      .set('Origin', 'https://evil.example')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not turn an unlisted preflight into a server error', async () => {
    const response = await request(server)
      .options('/api/v1/scans')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBeLessThan(500);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('lets requests without an Origin through (mobile app, probes)', async () => {
    const response = await request(server).get('/api/health').expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
