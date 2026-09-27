import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createE2eApp,
  registerUser,
  resetDatabase,
} from './support/e2e-app.js';

interface TokensBody {
  tokenType: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

interface SessionBody {
  user: { id: string; email: string; displayName: string | null };
  tokens: TokensBody;
}

interface ErrorBody {
  code: string;
}

const AUTH = '/api/v1/auth';
const ME = '/api/v1/users/me';
const PASSWORD = 'correct horse battery staple';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  const login = (email: string, password = PASSWORD): request.Test =>
    request(server).post(`${AUTH}/login`).send({ email, password });

  const refresh = (refreshToken: string): request.Test =>
    request(server).post(`${AUTH}/refresh`).send({ refreshToken });

  beforeAll(async () => {
    app = await createE2eApp();
    server = app.getHttpServer() as Server;
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers with a normalised email and returns a token pair', async () => {
    const response = await request(server)
      .post(`${AUTH}/register`)
      .send({
        email: '  Carol@Example.COM ',
        password: PASSWORD,
        displayName: ' Carol ',
      })
      .expect(201);
    const body = response.body as SessionBody;

    expect(response.headers['cache-control']).toBe('no-store');
    expect(body.user).toMatchObject({
      email: 'carol@example.com',
      displayName: 'Carol',
    });
    expect(body.tokens.tokenType).toBe('Bearer');
    expect(body.tokens.accessToken.split('.')).toHaveLength(3);
    expect(body.tokens.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(
      new Date(body.tokens.accessTokenExpiresAt).getTime(),
    ).toBeGreaterThan(Date.now());
  });

  it('refuses a second account for the same email in any case', async () => {
    const response = await request(server)
      .post(`${AUTH}/register`)
      .send({ email: 'CAROL@example.com', password: PASSWORD })
      .expect(409);

    expect((response.body as ErrorBody).code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('rejects a weak password or an invalid email at the DTO', async () => {
    await request(server)
      .post(`${AUTH}/register`)
      .send({ email: 'dave@example.com', password: 'short' })
      .expect(400);
    await request(server)
      .post(`${AUTH}/register`)
      .send({ email: 'not-an-email', password: PASSWORD })
      .expect(400);
  });

  it('logs in and answers a wrong password and an unknown email the same way', async () => {
    const ok = await login('carol@example.com').expect(200);
    expect((ok.body as SessionBody).user.email).toBe('carol@example.com');

    const wrong = await login('carol@example.com', 'wrong password!').expect(
      401,
    );
    const unknown = await login('nobody@example.com').expect(401);
    expect((wrong.body as ErrorBody).code).toBe('INVALID_CREDENTIALS');
    expect((unknown.body as ErrorBody).code).toBe('INVALID_CREDENTIALS');
  });

  it('protects /users/me and tells the client why a token was refused', async () => {
    const session = await registerUser(server, 'erin@example.com');

    const me = await request(server)
      .get(ME)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({
      id: session.userId,
      email: 'erin@example.com',
    });

    const missing = await request(server).get(ME).expect(401);
    expect((missing.body as ErrorBody).code).toBe('AUTHENTICATION_REQUIRED');

    const garbage = await request(server)
      .get(ME)
      .set('Authorization', 'Bearer not.a.jwt')
      .expect(401);
    expect((garbage.body as ErrorBody).code).toBe('INVALID_ACCESS_TOKEN');

    const jwt = app.get(JwtService);
    const expired = await jwt.signAsync(
      { sub: session.userId, typ: 'access' },
      { expiresIn: -60 },
    );
    const expiredResponse = await request(server)
      .get(ME)
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    expect((expiredResponse.body as ErrorBody).code).toBe(
      'ACCESS_TOKEN_EXPIRED',
    );

    const foreignKey = await jwt.signAsync(
      { sub: session.userId, typ: 'access' },
      { secret: 'x'.repeat(48) },
    );
    const foreignResponse = await request(server)
      .get(ME)
      .set('Authorization', `Bearer ${foreignKey}`)
      .expect(401);
    expect((foreignResponse.body as ErrorBody).code).toBe(
      'INVALID_ACCESS_TOKEN',
    );

    const wrongType = await jwt.signAsync({
      sub: session.userId,
      typ: 'refresh',
    });
    await request(server)
      .get(ME)
      .set('Authorization', `Bearer ${wrongType}`)
      .expect(401);
  });

  it('rotates refresh tokens and revokes the family when an old one is replayed', async () => {
    const session = await registerUser(server, 'frank@example.com');

    const rotated = await refresh(session.refreshToken).expect(200);
    const next = rotated.body as TokensBody;
    expect(next.refreshToken).not.toBe(session.refreshToken);
    expect(next.accessToken.split('.')).toHaveLength(3);

    const replay = await refresh(session.refreshToken).expect(401);
    expect((replay.body as ErrorBody).code).toBe('INVALID_REFRESH_TOKEN');

    await refresh(next.refreshToken).expect(401);
  });

  it('serialises concurrent refreshes of one token: one wins, then the family is revoked', async () => {
    const session = await registerUser(server, 'heidi@example.com');

    const results = await Promise.all([
      refresh(session.refreshToken),
      refresh(session.refreshToken),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 401]);

    const winner = results.find((r) => r.status === 200);
    const successor = (winner?.body as TokensBody).refreshToken;
    await refresh(successor).expect(401);
  });

  it('logs out one session and ignores unknown tokens', async () => {
    const session = await registerUser(server, 'grace@example.com');

    await request(server)
      .post(`${AUTH}/logout`)
      .send({ refreshToken: session.refreshToken })
      .expect(204);
    await refresh(session.refreshToken).expect(401);

    await request(server)
      .post(`${AUTH}/logout`)
      .send({ refreshToken: 'A'.repeat(43) })
      .expect(204);
    await refresh('bad token').expect(400);
  });
});
