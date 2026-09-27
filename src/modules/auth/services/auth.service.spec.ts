import type { JwtService } from '@nestjs/jwt';
import { type DataSource, IsNull, type Repository } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '@/config/app-config.service.js';
import { EmailAlreadyRegisteredError } from '@/modules/users/errors/users.errors.js';
import type { IUsersService } from '@/modules/users/interfaces/users-service.interface.js';
import type { UserModel } from '@/modules/users/models/user.model.js';
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
  REFRESH_TOKEN_PATTERN,
} from '../constants/auth.constants.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import {
  InvalidCredentialsError,
  InvalidRefreshTokenError,
} from '../errors/auth.errors.js';
import {
  dummyPasswordHash,
  hashPassword,
  verifyPassword,
} from '../utils/password-hasher.js';
import { hashRefreshToken } from '../utils/refresh-token.js';
import { AuthService } from './auth.service.js';

vi.mock('../utils/password-hasher.js', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  dummyPasswordHash: vi.fn(),
}));

const NOW = new Date('2026-09-23T10:00:00.000Z');
const USER_ID = '6f1c1c2a-4a55-4f0e-9d0a-1b2c3d4e5f60';
const FAMILY_ID = '0b9a4c52-6a0e-4a8c-9f39-2f1d6a7b8c9d';
const PRESENTED_TOKEN = 'A'.repeat(43);
const ACCESS_TTL_SECONDS = 900;
const REFRESH_TTL_DAYS = 30;
const SECRET = 's'.repeat(32);

const user: UserModel = {
  id: USER_ID,
  email: 'ana@example.com',
  displayName: 'Ana',
  createdAt: NOW,
};

function storedToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
  return {
    id: 'rt-1',
    userId: USER_ID,
    familyId: FAMILY_ID,
    tokenHash: hashRefreshToken(PRESENTED_TOKEN),
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    revokedAt: null,
    replacedById: null,
    createdAt: NOW,
    ...overrides,
  } as RefreshToken;
}

describe('AuthService', () => {
  let users: {
    create: ReturnType<typeof vi.fn>;
    findCredentialsByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let jwtService: { signAsync: ReturnType<typeof vi.fn> };
  let manager: {
    query: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
  };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let refreshTokens: {
    findOneBy: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let service: AuthService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(hashPassword).mockReset().mockResolvedValue('stored-hash');
    vi.mocked(verifyPassword).mockReset().mockResolvedValue(true);
    vi.mocked(dummyPasswordHash).mockReset().mockResolvedValue('dummy-hash');

    users = {
      create: vi.fn().mockResolvedValue(user),
      findCredentialsByEmail: vi
        .fn()
        .mockResolvedValue({ user, passwordHash: 'stored-hash' }),
      findById: vi.fn(),
    };
    jwtService = { signAsync: vi.fn().mockResolvedValue('signed-access') };
    manager = {
      query: vi.fn().mockResolvedValue([]),
      findOneBy: vi.fn().mockResolvedValue(storedToken()),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      insert: vi.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: vi.fn((callback: (m: typeof manager) => Promise<unknown>) =>
        callback(manager),
      ),
    };
    refreshTokens = {
      findOneBy: vi.fn().mockResolvedValue(storedToken()),
      insert: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    const config = {
      auth: {
        accessTokenSecret: SECRET,
        accessTokenTtlSeconds: ACCESS_TTL_SECONDS,
        refreshTokenTtlDays: REFRESH_TTL_DAYS,
      },
    };

    service = new AuthService(
      users as unknown as IUsersService,
      jwtService as unknown as JwtService,
      config as unknown as AppConfigService,
      dataSource as unknown as DataSource,
      refreshTokens as unknown as Repository<RefreshToken>,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function insertedRecord(): Record<string, unknown> {
    const [record] = refreshTokens.insert.mock.calls[0] as [
      Record<string, unknown>,
    ];
    return record;
  }

  describe('register', () => {
    it('normalises the input, hashes the password and returns a session in a new family', async () => {
      const session = await service.register({
        email: '  Ana@Example.COM ',
        password: ' pass word ',
        displayName: '  Ana  ',
      });

      expect(hashPassword).toHaveBeenCalledWith(' pass word ');
      expect(users.create).toHaveBeenCalledWith({
        email: 'ana@example.com',
        passwordHash: 'stored-hash',
        displayName: 'Ana',
      });
      expect(session.user).toBe(user);
      expect(session.tokens).toEqual({
        tokenType: 'Bearer',
        accessToken: 'signed-access',
        accessTokenExpiresAt: new Date(
          NOW.getTime() + ACCESS_TTL_SECONDS * 1000,
        ),
        refreshToken: expect.stringMatching(REFRESH_TOKEN_PATTERN) as string,
        refreshTokenExpiresAt: new Date(
          NOW.getTime() + REFRESH_TTL_DAYS * 86_400_000,
        ),
      });

      const record = insertedRecord();
      expect(record).toEqual({
        id: expect.any(String) as string,
        tokenHash: hashRefreshToken(session.tokens.refreshToken),
        userId: USER_ID,
        familyId: expect.any(String) as string,
        expiresAt: session.tokens.refreshTokenExpiresAt,
        revokedAt: null,
      });
      expect(Object.values(record)).not.toContain(session.tokens.refreshToken);
    });

    it('stores a blank display name as null', async () => {
      await service.register({
        email: 'ana@example.com',
        password: 'password1',
        displayName: '   ',
      });

      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: null }),
      );
    });

    it('signs an access token with the configured claims and lifetime', async () => {
      await service.register({
        email: 'ana@example.com',
        password: 'password1',
        displayName: null,
      });

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: USER_ID, typ: 'access' },
        {
          secret: SECRET,
          algorithm: JWT_ALGORITHM,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          expiresIn: ACCESS_TTL_SECONDS,
        },
      );
    });

    it('propagates EmailAlreadyRegisteredError without issuing tokens', async () => {
      users.create.mockRejectedValue(new EmailAlreadyRegisteredError());

      await expect(
        service.register({
          email: 'ana@example.com',
          password: 'password1',
          displayName: null,
        }),
      ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
      expect(refreshTokens.insert).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a session in a new family for the right password', async () => {
      const first = await service.login({
        email: ' ANA@example.com',
        password: 'password1',
      });
      const second = await service.login({
        email: 'ana@example.com',
        password: 'password1',
      });

      expect(users.findCredentialsByEmail).toHaveBeenCalledWith(
        'ana@example.com',
      );
      expect(verifyPassword).toHaveBeenCalledWith('password1', 'stored-hash');
      expect(first.user).toBe(user);
      expect(first.tokens.refreshToken).not.toBe(second.tokens.refreshToken);
      const [[firstRecord], [secondRecord]] = refreshTokens.insert.mock
        .calls as [[{ familyId: string }], [{ familyId: string }]];
      expect(firstRecord.familyId).not.toBe(secondRecord.familyId);
    });

    it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
      vi.mocked(verifyPassword).mockResolvedValue(false);

      await expect(
        service.login({ email: 'ana@example.com', password: 'wrong' }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(refreshTokens.insert).not.toHaveBeenCalled();
    });

    it('rejects an unknown email with the same error after still verifying against the dummy hash', async () => {
      users.findCredentialsByEmail.mockResolvedValue(null);
      vi.mocked(verifyPassword).mockResolvedValue(false);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password1' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
      expect(verifyPassword).toHaveBeenCalledWith('password1', 'dummy-hash');
      expect(refreshTokens.insert).not.toHaveBeenCalled();
    });

    it('rejects an unknown email even if the dummy hash happened to verify', async () => {
      users.findCredentialsByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password1' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });
  });

  function expectFamilyLocked(): void {
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [FAMILY_ID],
    );
  }

  function expectFamilyRevoked(): void {
    expect(manager.update).toHaveBeenCalledWith(
      RefreshToken,
      { familyId: FAMILY_ID, revokedAt: IsNull() },
      { revokedAt: expect.any(Function) as unknown },
    );
  }

  describe('refresh', () => {
    it('rotates the token within its family under the family lock, keeping the family expiry', async () => {
      const tokens = await service.refresh(PRESENTED_TOKEN);

      expect(refreshTokens.findOneBy).toHaveBeenCalledWith({
        tokenHash: hashRefreshToken(PRESENTED_TOKEN),
      });
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expectFamilyLocked();
      expect(manager.findOneBy).toHaveBeenCalledWith(RefreshToken, {
        id: 'rt-1',
      });

      const [successorEntity, successor] = manager.insert.mock.calls[0] as [
        typeof RefreshToken,
        {
          id: string;
          tokenHash: string;
          userId: string;
          familyId: string;
          expiresAt: Date;
        },
      ];
      expect(successorEntity).toBe(RefreshToken);
      expect(successor.familyId).toBe(FAMILY_ID);
      expect(successor.userId).toBe(USER_ID);
      expect(successor.tokenHash).toBe(hashRefreshToken(tokens.refreshToken));
      expect(successor.expiresAt).toEqual(storedToken().expiresAt);

      expect(manager.update).toHaveBeenCalledWith(
        RefreshToken,
        { id: 'rt-1' },
        {
          revokedAt: expect.any(Function) as unknown,
          replacedById: successor.id,
        },
      );
      expect(tokens.refreshToken).not.toBe(PRESENTED_TOKEN);
      expect(tokens.refreshToken).toMatch(REFRESH_TOKEN_PATTERN);
      expect(tokens.refreshTokenExpiresAt).toEqual(storedToken().expiresAt);
      expect(tokens.accessToken).toBe('signed-access');
    });

    it('rejects an unknown token', async () => {
      refreshTokens.findOneBy.mockResolvedValue(null);

      await expect(service.refresh(PRESENTED_TOKEN)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('treats a revoked token as reuse and revokes the whole family', async () => {
      manager.findOneBy.mockResolvedValue(
        storedToken({ revokedAt: new Date(NOW.getTime() - 1000) }),
      );

      await expect(service.refresh(PRESENTED_TOKEN)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      expectFamilyLocked();
      expectFamilyRevoked();
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('treats a token rotated by a concurrent refresh while waiting for the lock as reuse', async () => {
      refreshTokens.findOneBy.mockResolvedValue(storedToken());
      manager.findOneBy.mockResolvedValue(
        storedToken({ revokedAt: NOW, replacedById: 'rt-2' }),
      );

      await expect(service.refresh(PRESENTED_TOKEN)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      expectFamilyRevoked();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('rejects an expired token without rotating or revoking', async () => {
      manager.findOneBy.mockResolvedValue(storedToken({ expiresAt: NOW }));

      await expect(service.refresh(PRESENTED_TOKEN)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.insert).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes every active token of the family under the family lock', async () => {
      await service.logout(PRESENTED_TOKEN);

      expect(refreshTokens.findOneBy).toHaveBeenCalledWith({
        tokenHash: hashRefreshToken(PRESENTED_TOKEN),
      });
      expectFamilyLocked();
      expectFamilyRevoked();
    });

    it('ignores an unknown token', async () => {
      refreshTokens.findOneBy.mockResolvedValue(null);

      await expect(service.logout(PRESENTED_TOKEN)).resolves.toBeUndefined();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  it('computes the dummy hash when the module starts', async () => {
    await service.onModuleInit();

    expect(dummyPasswordHash).toHaveBeenCalledTimes(1);
  });
});
