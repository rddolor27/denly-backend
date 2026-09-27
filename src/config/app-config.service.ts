import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from './env.validation.js';
import { NodeEnv } from './env.validation.js';

export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password: string;
  readonly database: string;
}

export interface AuthConfig {
  readonly accessTokenSecret: string;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlDays: number;
}

/**
 * Thin typed wrapper around Nest's `ConfigService<EnvironmentVariables, true>` so the rest of the
 * app never reads raw env var names. `validateEnv` already guarantees these are present and
 * well-formed by the time anything injects this service.
 */
@Injectable()
export class AppConfigService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  get nodeEnv(): NodeEnv {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === NodeEnv.PRODUCTION;
  }

  get port(): number {
    return this.configService.get('PORT', { infer: true });
  }

  get database(): DatabaseConfig {
    return {
      host: this.configService.get('DB_HOST', { infer: true }),
      port: this.configService.get('DB_PORT', { infer: true }),
      username: this.configService.get('DB_USERNAME', { infer: true }),
      password: this.configService.get('DB_PASSWORD', { infer: true }),
      database: this.configService.get('DB_NAME', { infer: true }),
    };
  }

  get auth(): AuthConfig {
    return {
      accessTokenSecret: this.configService.get('JWT_ACCESS_SECRET', {
        infer: true,
      }),
      accessTokenTtlSeconds: this.configService.get('JWT_ACCESS_TTL_SECONDS', {
        infer: true,
      }),
      refreshTokenTtlDays: this.configService.get('REFRESH_TOKEN_TTL_DAYS', {
        infer: true,
      }),
    };
  }
}
