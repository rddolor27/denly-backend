import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/commons/auth/authenticated-user.js';
import { IS_PUBLIC_KEY } from '@/commons/auth/public.decorator.js';
import {
  AccessTokenExpiredError,
  AuthenticationRequiredError,
  InvalidAccessTokenError,
} from '../errors/auth.errors.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const USER: AuthenticatedUser = { id: '6f1c1c2a-4a55-4f0e-9d0a-1b2c3d4e5f60' };

function handler(): void {}
class TestController {}

function contextWithHeaders(headers: Record<string, string>): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

const withToken = contextWithHeaders({ authorization: 'Bearer abc.def.ghi' });
const withoutToken = contextWithHeaders({});

describe('JwtAuthGuard', () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('canActivate', () => {
    function spyOnPassport() {
      const passportGuard = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
        canActivate: (context: ExecutionContext) => Promise<boolean>;
      };
      return vi.spyOn(passportGuard, 'canActivate').mockResolvedValue(true);
    }

    it('lets public routes through without running passport', () => {
      const passport = spyOnPassport();
      reflector.getAllAndOverride.mockReturnValue(true);

      expect(guard.canActivate(withoutToken)).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        handler,
        TestController,
      ]);
      expect(passport).not.toHaveBeenCalled();
    });

    it('runs passport for every other route', async () => {
      const passport = spyOnPassport();

      await expect(guard.canActivate(withToken)).resolves.toBe(true);
      expect(passport).toHaveBeenCalledWith(withToken);
    });
  });

  describe('handleRequest', () => {
    it('returns the validated user', () => {
      expect(guard.handleRequest(null, USER, undefined, withToken)).toBe(USER);
    });

    it('requires authentication when no Authorization header was sent', () => {
      expect(() =>
        guard.handleRequest(
          null,
          false,
          new Error('No auth token'),
          withoutToken,
        ),
      ).toThrow(AuthenticationRequiredError);
    });

    it('reports an expired token as ACCESS_TOKEN_EXPIRED', () => {
      const info = new TokenExpiredError('jwt expired', new Date());

      expect(() => guard.handleRequest(null, false, info, withToken)).toThrow(
        AccessTokenExpiredError,
      );
    });

    it.each([
      [
        'a bad signature',
        new JsonWebTokenError('invalid signature'),
        withToken,
      ],
      [
        'a non-bearer Authorization header',
        new Error('No auth token'),
        contextWithHeaders({ authorization: 'Basic YWJj' }),
      ],
      ['no info', undefined, withToken],
    ])('reports %s as INVALID_ACCESS_TOKEN', (_label, info, context) => {
      expect(() => guard.handleRequest(null, false, info, context)).toThrow(
        InvalidAccessTokenError,
      );
    });

    it('rethrows a domain error raised while validating the payload', () => {
      const error = new InvalidAccessTokenError();

      expect(() =>
        guard.handleRequest(error, false, undefined, withToken),
      ).toThrow(error);
    });

    it('maps any other error to INVALID_ACCESS_TOKEN', () => {
      expect(() =>
        guard.handleRequest(new Error('boom'), false, undefined, withToken),
      ).toThrow(InvalidAccessTokenError);
    });
  });
});
