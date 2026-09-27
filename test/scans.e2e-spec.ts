import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createE2eApp,
  registerUser,
  RETIRED_MODEL_VERSION,
  resetDatabase,
  seedCatalogAndRegistry,
  TEST_MODEL_VERSION,
  type TestSession,
} from './support/e2e-app.js';

interface DetectionPayload {
  classId: number;
  className: string;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  confidence: number;
  modelVersion?: string;
}

interface ScanBody {
  id: string;
  modelVersion: string;
  rulesVersion: string;
  promptVersion: string | null;
  detections: { id: string; className: string }[];
  ingredients: {
    slug: string;
    confidence: number;
    confidenceBand: string;
    detectionIds: string[];
    ruleHits: string[];
  }[];
  unknowns: unknown[];
  flags: string[];
  analysisStatus: string;
  analysis: unknown;
}

interface ScanPageBody {
  items: { id: string; ingredients: { slug: string }[] }[];
  nextCursor: string | null;
}

interface ErrorBody {
  code: string;
  details?: Record<string, unknown>;
}

const SCANS = '/api/v1/scans';

const detection = (
  classId: number,
  className: string,
  confidence: number,
  x = 0.1,
): DetectionPayload => ({
  classId,
  className,
  bbox: { x1: x, y1: 0.1, x2: x + 0.2, y2: 0.4 },
  confidence,
});

const run = (
  detections: DetectionPayload[],
  modelVersion = TEST_MODEL_VERSION,
): Record<string, unknown> => ({
  modelVersion,
  imageSize: { w: 1920, h: 1440 },
  latencyMs: 38,
  detections,
});

describe('Scans (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let alice: TestSession;
  let bob: TestSession;

  const bearer = (session: TestSession): string =>
    `Bearer ${session.accessToken}`;

  const submit = (
    body: Record<string, unknown>,
    session: TestSession = alice,
  ): request.Test =>
    request(server)
      .post(SCANS)
      .set('Authorization', bearer(session))
      .send(body);

  beforeAll(async () => {
    app = await createE2eApp();
    server = app.getHttpServer() as Server;
    await resetDatabase(app);
    await seedCatalogAndRegistry(app);
    alice = await registerUser(server, 'alice@example.com');
    bob = await registerUser(server, 'bob@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires an access token', async () => {
    const response = await request(server)
      .post(SCANS)
      .send(run([]))
      .expect(401);

    expect((response.body as ErrorBody).code).toBe('AUTHENTICATION_REQUIRED');
    await request(server).get(SCANS).expect(401);
  });

  it('turns a detection run into structured ingredient data', async () => {
    const response = await submit(
      run([
        { ...detection(0, 'egg', 0.92), modelVersion: TEST_MODEL_VERSION },
        detection(0, 'egg', 0.81, 0.5),
        detection(1, 'tomato', 0.5),
        detection(61, 'shrimp', 0.3),
        detection(3, 'garlic', 0.1),
      ]),
    ).expect(201);
    const body = response.body as ScanBody;

    expect(body).toMatchObject({
      modelVersion: TEST_MODEL_VERSION,
      rulesVersion: 'rules-2026.09.1',
      promptVersion: null,
      unknowns: [],
      flags: ['contains_crustacean_shellfish', 'contains_egg'],
      analysisStatus: 'unavailable',
      analysis: null,
    });
    expect(body.detections).toHaveLength(5);
    expect(
      body.ingredients.map((i) => [i.slug, i.confidenceBand, i.ruleHits]),
    ).toEqual([
      ['egg', 'high', ['contains-egg']],
      ['tomato', 'medium', []],
      ['shrimp', 'low', ['contains-crustacean-shellfish']],
    ]);

    const eggDetectionIds = body.detections
      .filter((d) => d.className === 'egg')
      .map((d) => d.id)
      .sort();
    expect(body.ingredients[0]?.detectionIds).toEqual(eggDetectionIds);
  });

  it('returns the owner their stored scan unchanged and hides it from others', async () => {
    const created = await submit(
      run([detection(51, 'chicken_raw', 0.88), detection(67, 'tofu', 0.66)]),
    ).expect(201);
    const createdBody = created.body as ScanBody;
    expect(createdBody.flags).toEqual(['contains_meat', 'contains_soy']);

    const fetched = await request(server)
      .get(`${SCANS}/${createdBody.id}`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(fetched.body).toEqual(createdBody);

    const foreign = await request(server)
      .get(`${SCANS}/${createdBody.id}`)
      .set('Authorization', bearer(bob))
      .expect(404);
    expect((foreign.body as ErrorBody).code).toBe('SCAN_NOT_FOUND');
  });

  it('pages through the owner history newest first', async () => {
    await submit(run([detection(1, 'tomato', 0.9)]), bob).expect(201);
    await submit(run([detection(3, 'garlic', 0.9)]), bob).expect(201);
    await submit(run([detection(67, 'tofu', 0.9)]), bob).expect(201);

    const first = await request(server)
      .get(`${SCANS}?limit=2`)
      .set('Authorization', bearer(bob))
      .expect(200);
    const firstPage = first.body as ScanPageBody;
    expect(firstPage.items.map((s) => s.ingredients[0]?.slug)).toEqual([
      'tofu',
      'garlic',
    ]);
    expect(firstPage.nextCursor).not.toBeNull();

    const second = await request(server)
      .get(`${SCANS}?limit=2&cursor=${String(firstPage.nextCursor)}`)
      .set('Authorization', bearer(bob))
      .expect(200);
    const secondPage = second.body as ScanPageBody;
    expect(secondPage.items.map((s) => s.ingredients[0]?.slug)).toEqual([
      'tomato',
    ]);
    expect(secondPage.nextCursor).toBeNull();

    await request(server)
      .get(`${SCANS}?cursor=bm90LWEtY3Vyc29y`)
      .set('Authorization', bearer(bob))
      .expect(400);
  });

  it('accepts an empty run', async () => {
    const response = await submit(run([])).expect(201);
    const body = response.body as ScanBody;

    expect(body.ingredients).toEqual([]);
    expect(body.flags).toEqual([]);
  });

  it('rejects an unknown model version', async () => {
    const response = await submit(run([], 'yolov8n-ingredients-9.9.9')).expect(
      422,
    );
    const body = response.body as ErrorBody;

    expect(body.code).toBe('UNSUPPORTED_MODEL_VERSION');
    expect(body.details).toMatchObject({ reason: 'unknown' });
  });

  it('rejects a retired model version', async () => {
    const response = await submit(
      run([detection(0, 'egg', 0.9)], RETIRED_MODEL_VERSION),
    ).expect(422);
    const body = response.body as ErrorBody;

    expect(body.code).toBe('UNSUPPORTED_MODEL_VERSION');
    expect(body.details).toMatchObject({ reason: 'retired' });
  });

  it('rejects a class pair that is not in the model version', async () => {
    const response = await submit(
      run([detection(0, 'tomato', 0.9), detection(2, 'onion', 0.9)]),
    ).expect(422);
    const body = response.body as ErrorBody;

    expect(body.code).toBe('INVALID_DETECTION');
    expect(body.details).toMatchObject({
      issueCount: 2,
      issues: [
        { index: 0, reason: 'UNKNOWN_CLASS' },
        { index: 1, reason: 'UNKNOWN_CLASS' },
      ],
    });
  });

  it('rejects an inverted bounding box', async () => {
    const inverted = {
      ...detection(0, 'egg', 0.9),
      bbox: { x1: 0.6, y1: 0.1, x2: 0.2, y2: 0.4 },
    };
    const response = await submit(run([inverted])).expect(422);

    expect((response.body as ErrorBody).details).toMatchObject({
      issues: [{ index: 0, reason: 'INVALID_BBOX' }],
    });
  });

  it('rejects out-of-range values, extra fields and oversized runs at the DTO', async () => {
    await submit(run([detection(0, 'egg', 1.2)])).expect(400);
    await submit({ ...run([]), image: 'base64' }).expect(400);
    await submit(
      run(Array.from({ length: 101 }, () => detection(0, 'egg', 0.9))),
    ).expect(400);
  });

  it('returns SCAN_NOT_FOUND for an unknown id and 400 for a malformed one', async () => {
    const response = await request(server)
      .get(`${SCANS}/6f1c1b8e-8d8e-4c7a-9c1e-1b2d3c4e5f60`)
      .set('Authorization', bearer(alice))
      .expect(404);

    expect((response.body as ErrorBody).code).toBe('SCAN_NOT_FOUND');
    await request(server)
      .get(`${SCANS}/not-a-uuid`)
      .set('Authorization', bearer(alice))
      .expect(400);
  });
});
