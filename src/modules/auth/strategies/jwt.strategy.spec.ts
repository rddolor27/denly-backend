import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppConfigService } from '@/config/app-config.service.js';
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from '../constants/auth.constants.js';
import { InvalidAccessTokenError } from '../errors/auth.errors.js';
import { JwtStrategy } from './jwt.strategy.js';

const SECRET = 's'.repeat(32);
const USER_ID = '6f1c1c2a-4a55-4f0e-9d0a-1b2c3d4e5f60';

interface Outcome {
  readonly user?: unknown;
  readonly info?: unknown;
  readonly error?: unknown;
}

interface PassportActions {
  success: (user: unknown) => void;
  fail: (info: unknown) => void;
  error: (error: unknown) => void;
  authenticate: (request: unknown) => void;
}

function authenticate(strategy: JwtStrategy, token: string): Promise<Outcome> {
  return new Promise((resolve) => {
    const actions = strategy as unknown as PassportActions;
    actions.success = (user) => resolve({ user });
    actions.fail = (info) => resolve({ info });
    actions.error = (error) => resolve({ error });
    actions.authenticate({ headers: { authorization: `Bearer ${token}` } });
  });
}

describe('JwtStrategy', () => {
  const jwt = new JwtService({ secret: SECRET });
  let strategy: JwtStrategy;

  function sign(
    payload: object,
    overrides: { audience?: string; expiresIn?: number } = {},
  ): Promise<string> {
    return jwt.signAsync(payload, {
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience: overrides.audience ?? JWT_AUDIENCE,
      expiresIn: overrides.expiresIn ?? 900,
    });
  }

  beforeEach(() => {
    const config = {
      auth: {
        accessTokenSecret: SECRET,
        accessTokenTtlSeconds: 900,
        refreshTokenTtlDays: 30,
      },
    };
    strategy = new JwtStrategy(config as unknown as AppConfigService);
  });

  describe('validate', () => {
    it('maps an access token payload to the authenticated user', () => {
      expect(
        strategy.validate({ sub: USER_ID, typ: 'access', iat: 1, exp: 2 }),
      ).toEqual({ id: USER_ID });
    });

    it.each([
      ['a refresh typ', { sub: USER_ID, typ: 'refresh' }],
      ['no typ', { sub: USER_ID }],
      ['no sub', { typ: 'access' }],
      ['a non-uuid sub', { sub: 'admin', typ: 'access' }],
      ['a numeric sub', { sub: 42, typ: 'access' }],
      ['a string payload', 'access'],
      ['null', null],
    ])('rejects %s', (_label, payload) => {
      expect(() => strategy.validate(payload)).toThrow(InvalidAccessTokenError);
    });
  });

  describe('token verification', () => {
    it('authenticates a bearer token signed with the configured issuer and audience', async () => {
      const token = await sign({ sub: USER_ID, typ: 'access' });

      await expect(authenticate(strategy, token)).resolves.toEqual({
        user: { id: USER_ID },
      });
    });

    it('fails an expired token with a TokenExpiredError', async () => {
      const token = await sign(
        {
          sub: USER_ID,
          typ: 'access',
          iat: Math.floor(Date.now() / 1000) - 120,
        },
        { expiresIn: 60 },
      );

      const outcome = await authenticate(strategy, token);

      expect(outcome.info).toBeInstanceOf(Error);
      expect((outcome.info as Error).name).toBe('TokenExpiredError');
    });

    it('fails a token issued for another audience', async () => {
      const token = await sign(
        { sub: USER_ID, typ: 'access' },
        { audience: 'someone-else' },
      );

      const outcome = await authenticate(strategy, token);

      expect(outcome.user).toBeUndefined();
      expect((outcome.info as Error).name).toBe('JsonWebTokenError');
    });

    it('fails a token signed with another secret', async () => {
      const token = await new JwtService({ secret: 'x'.repeat(32) }).signAsync(
        { sub: USER_ID, typ: 'access' },
        { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: 900 },
      );

      const outcome = await authenticate(strategy, token);

      expect(outcome.user).toBeUndefined();
      expect((outcome.info as Error).message).toBe('invalid signature');
    });
  });
});
