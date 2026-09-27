import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  Validate,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  validateSync,
} from 'class-validator';
import { describeInvalidCorsOrigin, splitCorsOrigins } from './cors-origins.js';

export enum NodeEnv {
  DEVELOPMENT = 'development',
  TEST = 'test',
  PRODUCTION = 'production',
}

/** `LOG_LEVEL` values; Nest's `log` maps to `info`, `verbose` to `debug`. */
export enum AppLogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/** `LOG_FORMAT` values: one Cloud Logging JSON object per line, or a readable dev line. */
export enum LogFormat {
  JSON = 'json',
  PRETTY = 'pretty',
}

// GCP project ids: 6-30 chars, lowercase letters, digits and hyphens, starting with a letter.
const GCP_PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

@ValidatorConstraint({ name: 'corsOrigins' })
class CorsOriginsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      typeof value === 'string' &&
      splitCorsOrigins(value).every(
        (entry) => describeInvalidCorsOrigin(entry) === undefined,
      )
    );
  }

  defaultMessage(args: ValidationArguments): string {
    const value: unknown = args.value;
    if (typeof value !== 'string') return 'CORS_ORIGINS must be a string';
    const problems = splitCorsOrigins(value)
      .map((entry) => describeInvalidCorsOrigin(entry))
      .filter((problem) => problem !== undefined);
    return `CORS_ORIGINS must list exact http(s) origins separated by commas: ${problems.join('; ')}`;
  }
}

/**
 * The one typed, validated shape of `process.env` this app relies on. Extend this class (and
 * `.env.example`) whenever a new env var is introduced — nothing outside `src/config/` reads
 * `process.env` directly.
 */
export class EnvironmentVariables {
  @IsIn([NodeEnv.DEVELOPMENT, NodeEnv.TEST, NodeEnv.PRODUCTION])
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.DEVELOPMENT;

  @IsInt()
  @Min(1)
  @Max(65_535)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  DB_HOST: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(65_535)
  @IsOptional()
  DB_PORT: number = 5432;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME!: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME!: string;

  // HS256 signing key for access tokens; 32+ characters of random data, never shared across envs.
  @IsString()
  @MinLength(32)
  @Matches(/^(?!.*(change-?me|placeholder|example|your-?secret)).*$/is, {
    message:
      "JWT_ACCESS_SECRET looks like a placeholder; generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
  })
  JWT_ACCESS_SECRET!: string;

  @IsInt()
  @Min(60)
  @Max(86_400)
  @IsOptional()
  JWT_ACCESS_TTL_SECONDS: number = 900;

  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  REFRESH_TOKEN_TTL_DAYS: number = 30;

  // Unset -> default by NODE_ENV (AppConfigService.logging): production info, test warn,
  // development debug. Set-but-empty is rejected like any other invalid value.
  @IsIn(Object.values(AppLogLevel))
  @IsOptional()
  LOG_LEVEL?: AppLogLevel;

  // Unset -> json in production, pretty otherwise.
  @IsIn(Object.values(LogFormat))
  @IsOptional()
  LOG_FORMAT?: LogFormat;

  // Comma-separated exact browser origins; empty = no browser origin allowed. Requests without an
  // Origin header (the mobile app, curl, health probes) are unaffected.
  @Validate(CorsOriginsConstraint)
  @IsOptional()
  CORS_ORIGINS?: string;

  // Lets JSON logs carry `logging.googleapis.com/trace` so Cloud Logging groups them per request.
  @Matches(GCP_PROJECT_ID_PATTERN, {
    message:
      'GCP_PROJECT_ID must be a GCP project id (6-30 lowercase letters, digits or hyphens, starting with a letter)',
  })
  @IsOptional()
  GCP_PROJECT_ID?: string;
}

/**
 * `@nestjs/config` validate hook: runs at boot, before anything else, so missing/invalid config
 * fails fast with one clear error instead of surfacing later as a broken query or a silent
 * `undefined`.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return validated;
}
