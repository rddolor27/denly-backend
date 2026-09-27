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
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  DEVELOPMENT = 'development',
  TEST = 'test',
  PRODUCTION = 'production',
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
