import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  type OnModuleInit,
  type Provider,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  type DataSource,
  type EntityManager,
  IsNull,
  type Repository,
} from 'typeorm';
import type { AccessTokenPayload } from '@/commons/auth/authenticated-user.js';
import { AppConfigService } from '@/config/app-config.service.js';
import { InjectUsersService } from '@/modules/users/constants/users.constants.js';
import type { IUsersService } from '@/modules/users/interfaces/users-service.interface.js';
import { normalizeEmail } from '@/modules/users/utils/normalize-email.js';
import {
  AUTH_SERVICE,
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from '../constants/auth.constants.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import {
  InvalidCredentialsError,
  InvalidRefreshTokenError,
} from '../errors/auth.errors.js';
import type {
  IAuthService,
  LoginInput,
  RegisterInput,
} from '../interfaces/auth-service.interface.js';
import type { AuthSession, AuthTokens } from '../models/auth-session.model.js';
import {
  dummyPasswordHash,
  hashPassword,
  verifyPassword,
} from '../utils/password-hasher.js';
import {
  generateRefreshToken,
  hashRefreshToken,
} from '../utils/refresh-token.js';

const MS_PER_SECOND = 1000;
const MS_PER_DAY = 86_400_000;

interface SignedAccessToken {
  readonly token: string;
  readonly expiresAt: Date;
}

interface IssuedRefreshToken {
  readonly token: string;
  readonly record: Pick<
    RefreshToken,
    'id' | 'tokenHash' | 'userId' | 'familyId' | 'expiresAt' | 'revokedAt'
  >;
}

type RefreshOutcome =
  | { readonly kind: 'rotated'; readonly tokens: AuthTokens }
  | { readonly kind: 'reused' }
  | { readonly kind: 'expired' };

// Serialises rotation, reuse detection and logout per family, so none can miss a token another
// transaction is about to commit. Released at commit or rollback.
async function lockFamily(
  manager: EntityManager,
  familyId: string,
): Promise<void> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    familyId,
  ]);
}

async function revokeFamilyTokens(
  manager: EntityManager,
  familyId: string,
): Promise<void> {
  await manager.update(
    RefreshToken,
    { familyId, revokedAt: IsNull() },
    { revokedAt: () => 'now()' },
  );
}

function normalizeDisplayName(displayName: string | null): string | null {
  const trimmed = displayName?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

@Injectable()
export class AuthService implements IAuthService, OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectUsersService() private readonly users: IUsersService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  async onModuleInit(): Promise<void> {
    await dummyPasswordHash();
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    const user = await this.users.create({
      email: normalizeEmail(input.email),
      passwordHash: await hashPassword(input.password),
      displayName: normalizeDisplayName(input.displayName),
    });
    const tokens = await this.startSession(user.id);
    this.logger.log(`[register] user=${user.id}`);
    return { user, tokens };
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const credentials = await this.users.findCredentialsByEmail(
      normalizeEmail(input.email),
    );
    const passwordMatches = await verifyPassword(
      input.password,
      credentials?.passwordHash ?? (await dummyPasswordHash()),
    );
    if (!credentials || !passwordMatches) {
      this.logger.warn('[login] rejected');
      throw new InvalidCredentialsError();
    }
    const tokens = await this.startSession(credentials.user.id);
    this.logger.log(`[login] user=${credentials.user.id}`);
    return { user: credentials.user, tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const found = await this.refreshTokens.findOneBy({
      tokenHash: hashRefreshToken(refreshToken),
    });
    if (!found) throw new InvalidRefreshTokenError();

    const outcome = await this.dataSource.transaction(
      async (manager): Promise<RefreshOutcome> => {
        await lockFamily(manager, found.familyId);
        const current = await manager.findOneBy(RefreshToken, {
          id: found.id,
        });
        if (!current || current.revokedAt !== null) {
          await revokeFamilyTokens(manager, found.familyId);
          return { kind: 'reused' };
        }
        if (current.expiresAt.getTime() <= Date.now()) {
          return { kind: 'expired' };
        }
        const successor = this.newRefreshToken(
          current.userId,
          current.familyId,
          current.expiresAt,
        );
        await manager.update(
          RefreshToken,
          { id: current.id },
          { revokedAt: () => 'now()', replacedById: successor.record.id },
        );
        await manager.insert(RefreshToken, successor.record);
        const access = await this.signAccessToken(current.userId);
        return { kind: 'rotated', tokens: this.toTokens(access, successor) };
      },
    );

    if (outcome.kind === 'rotated') return outcome.tokens;
    if (outcome.kind === 'reused') {
      this.logger.warn(`[refresh] reuse detected family=${found.familyId}`);
    }
    throw new InvalidRefreshTokenError();
  }

  async logout(refreshToken: string): Promise<void> {
    const current = await this.refreshTokens.findOneBy({
      tokenHash: hashRefreshToken(refreshToken),
    });
    if (!current) return;
    await this.dataSource.transaction(async (manager) => {
      await lockFamily(manager, current.familyId);
      await revokeFamilyTokens(manager, current.familyId);
    });
    this.logger.log(`[logout] family=${current.familyId}`);
  }

  private async startSession(userId: string): Promise<AuthTokens> {
    const refreshToken = this.newRefreshToken(userId, randomUUID());
    await this.refreshTokens.insert(refreshToken.record);
    return this.toTokens(await this.signAccessToken(userId), refreshToken);
  }

  private async signAccessToken(userId: string): Promise<SignedAccessToken> {
    const { accessTokenSecret, accessTokenTtlSeconds } = this.config.auth;
    const payload: AccessTokenPayload = { sub: userId, typ: 'access' };
    // jsonwebtoken stamps `exp` on whole seconds; flooring keeps the reported expiry at or before it.
    const issuedAt = Math.floor(Date.now() / MS_PER_SECOND);
    const expiresAt = new Date(
      (issuedAt + accessTokenTtlSeconds) * MS_PER_SECOND,
    );
    const token = await this.jwtService.signAsync(payload, {
      secret: accessTokenSecret,
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: accessTokenTtlSeconds,
    });
    return { token, expiresAt };
  }

  // A successor keeps its family's expiry, so a sign-in lasts at most REFRESH_TOKEN_TTL_DAYS.
  private newRefreshToken(
    userId: string,
    familyId: string,
    familyExpiresAt?: Date,
  ): IssuedRefreshToken {
    const token = generateRefreshToken();
    return {
      token,
      record: {
        id: randomUUID(),
        tokenHash: hashRefreshToken(token),
        userId,
        familyId,
        expiresAt:
          familyExpiresAt ??
          new Date(
            Date.now() + this.config.auth.refreshTokenTtlDays * MS_PER_DAY,
          ),
        revokedAt: null,
      },
    };
  }

  private toTokens(
    access: SignedAccessToken,
    refresh: IssuedRefreshToken,
  ): AuthTokens {
    return {
      tokenType: 'Bearer',
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.record.expiresAt,
    };
  }
}

export const AuthProvider: Provider = {
  provide: AUTH_SERVICE,
  useClass: AuthService,
};
