import { HttpStatus } from '@nestjs/common';
import {
  HEADERS_METADATA,
  HTTP_CODE_METADATA,
} from '@nestjs/common/constants.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '@/commons/auth/public.decorator.js';
import type { UserModel } from '@/modules/users/models/user.model.js';
import type { IAuthService } from '../interfaces/auth-service.interface.js';
import type { AuthTokens } from '../models/auth-session.model.js';
import { AuthController } from './auth.controller.js';

const REFRESH_TOKEN = 'A'.repeat(43);

const user: UserModel = {
  id: '6f1c1c2a-4a55-4f0e-9d0a-1b2c3d4e5f60',
  email: 'ana@example.com',
  displayName: null,
  createdAt: new Date('2026-09-23T10:00:00.000Z'),
};

const tokens: AuthTokens = {
  tokenType: 'Bearer',
  accessToken: 'signed-access',
  accessTokenExpiresAt: new Date('2026-09-23T10:15:00.000Z'),
  refreshToken: REFRESH_TOKEN,
  refreshTokenExpiresAt: new Date('2026-10-23T10:00:00.000Z'),
};

const tokensResponse = {
  tokenType: 'Bearer',
  accessToken: 'signed-access',
  accessTokenExpiresAt: '2026-09-23T10:15:00.000Z',
  refreshToken: REFRESH_TOKEN,
  refreshTokenExpiresAt: '2026-10-23T10:00:00.000Z',
};

describe('AuthController', () => {
  let authServiceMock: {
    register: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let controller: AuthController;

  beforeEach(() => {
    authServiceMock = {
      register: vi.fn().mockResolvedValue({ user, tokens }),
      login: vi.fn().mockResolvedValue({ user, tokens }),
      refresh: vi.fn().mockResolvedValue(tokens),
      logout: vi.fn().mockResolvedValue(undefined),
    };
    controller = new AuthController(authServiceMock as unknown as IAuthService);
  });

  it('is public and never cached', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController)).toBe(true);
    for (const handler of [
      controller.register,
      controller.login,
      controller.refresh,
      controller.logout,
    ]) {
      expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toEqual([
        { name: 'Cache-Control', value: 'no-store' },
      ]);
    }
  });

  it('answers 200 for login and refresh and 204 for logout', () => {
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, controller.login)).toBe(
      HttpStatus.OK,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, controller.refresh)).toBe(
      HttpStatus.OK,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, controller.logout)).toBe(
      HttpStatus.NO_CONTENT,
    );
  });

  it('registers with a null display name when none is sent and returns the session', async () => {
    const result = await controller.register({
      email: 'ana@example.com',
      password: 'password1',
    });

    expect(authServiceMock.register).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'password1',
      displayName: null,
    });
    expect(result).toEqual({
      user: {
        id: user.id,
        email: 'ana@example.com',
        displayName: null,
        createdAt: '2026-09-23T10:00:00.000Z',
      },
      tokens: tokensResponse,
    });
  });

  it('logs in and returns the session', async () => {
    const result = await controller.login({
      email: 'ana@example.com',
      password: 'password1',
    });

    expect(authServiceMock.login).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'password1',
    });
    expect(result.tokens).toEqual(tokensResponse);
  });

  it('refreshes and returns the new token pair', async () => {
    const result = await controller.refresh({ refreshToken: REFRESH_TOKEN });

    expect(authServiceMock.refresh).toHaveBeenCalledWith(REFRESH_TOKEN);
    expect(result).toEqual(tokensResponse);
  });

  it('logs out', async () => {
    await expect(
      controller.logout({ refreshToken: REFRESH_TOKEN }),
    ).resolves.toBeUndefined();
    expect(authServiceMock.logout).toHaveBeenCalledWith(REFRESH_TOKEN);
  });
});
