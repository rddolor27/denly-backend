import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigService } from './app-config.service.js';
import {
  AppLogLevel,
  type EnvironmentVariables,
  LogFormat,
  NodeEnv,
  validateEnv,
} from './env.validation.js';

// Test-only values; never a real credential.
const BASE_ENV = {
  DB_USERNAME: 'denly_test_user',
  DB_PASSWORD: 'unit-test-password',
  DB_NAME: 'denly_test',
  JWT_ACCESS_SECRET: 'u'.repeat(48),
} as const;

const NEW_VARS = ['LOG_LEVEL', 'LOG_FORMAT', 'CORS_ORIGINS', 'GCP_PROJECT_ID'];

function configFor(env: Record<string, string>): AppConfigService {
  return new AppConfigService(
    new ConfigService<EnvironmentVariables, true>(
      validateEnv({ ...BASE_ENV, ...env }),
    ),
  );
}

// ConfigService falls back to process.env for unset keys; keep the shell's values out of the test.
beforeEach(() => {
  for (const name of NEW_VARS) vi.stubEnv(name, undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('validateEnv — logging and CORS', () => {
  it('accepts valid values for the new variables', () => {
    const env = validateEnv({
      ...BASE_ENV,
      LOG_LEVEL: 'debug',
      LOG_FORMAT: 'json',
      CORS_ORIGINS: 'https://admin.denly.app, http://localhost:8081',
      GCP_PROJECT_ID: 'denly-prod-123',
    });

    expect(env.LOG_LEVEL).toBe(AppLogLevel.DEBUG);
    expect(env.LOG_FORMAT).toBe(LogFormat.JSON);
    expect(env.GCP_PROJECT_ID).toBe('denly-prod-123');
  });

  it('accepts all four as unset, and an empty CORS_ORIGINS', () => {
    expect(() => validateEnv({ ...BASE_ENV })).not.toThrow();
    expect(() => validateEnv({ ...BASE_ENV, CORS_ORIGINS: '' })).not.toThrow();
  });

  it.each([
    ['LOG_LEVEL', 'verbose', /LOG_LEVEL must be one of/],
    ['LOG_LEVEL', '', /LOG_LEVEL must be one of/],
    ['LOG_FORMAT', 'text', /LOG_FORMAT must be one of/],
    ['GCP_PROJECT_ID', 'Denly_Prod', /GCP_PROJECT_ID must be a GCP project id/],
    ['GCP_PROJECT_ID', 'abc', /GCP_PROJECT_ID must be a GCP project id/],
  ])('rejects %s=%j', (name, value, message) => {
    expect(() => validateEnv({ ...BASE_ENV, [name]: value })).toThrow(message);
  });

  it.each([
    ['*', /wildcard "\*" is not allowed/],
    [
      'https://admin.denly.app/',
      /not a bare origin.*expected "https:\/\/admin.denly.app"/,
    ],
    ['https://admin.denly.app/path', /not a bare origin/],
    ['https://admin.denly.app?x=1', /not a bare origin/],
    ['https://Admin.Denly.app', /not a bare origin/],
    ['https://admin.denly.app:443', /not a bare origin/],
    ['ftp://files.denly.app', /must use http or https/],
    ['admin.denly.app', /is not a URL/],
    ['https://ok.denly.app,*', /wildcard/],
  ])('rejects CORS_ORIGINS=%j', (value, message) => {
    expect(() => validateEnv({ ...BASE_ENV, CORS_ORIGINS: value })).toThrow(
      message,
    );
  });
});

describe('AppConfigService — logging and CORS', () => {
  it.each([
    [NodeEnv.PRODUCTION, AppLogLevel.INFO, LogFormat.JSON],
    [NodeEnv.TEST, AppLogLevel.WARN, LogFormat.PRETTY],
    [NodeEnv.DEVELOPMENT, AppLogLevel.DEBUG, LogFormat.PRETTY],
  ])('defaults logging for NODE_ENV=%s', (nodeEnv, level, format) => {
    expect(configFor({ NODE_ENV: nodeEnv }).logging).toEqual({ level, format });
  });

  it('lets LOG_LEVEL, LOG_FORMAT and GCP_PROJECT_ID override the defaults', () => {
    expect(
      configFor({
        NODE_ENV: NodeEnv.PRODUCTION,
        LOG_LEVEL: 'debug',
        LOG_FORMAT: 'pretty',
        GCP_PROJECT_ID: 'denly-prod',
      }).logging,
    ).toEqual({
      level: AppLogLevel.DEBUG,
      format: LogFormat.PRETTY,
      gcpProjectId: 'denly-prod',
    });
  });

  it('parses CORS_ORIGINS into exact origins (none when unset)', () => {
    expect(configFor({}).corsOrigins).toEqual([]);
    expect(
      configFor({
        CORS_ORIGINS: ' https://admin.denly.app ,http://localhost:8081,',
      }).corsOrigins,
    ).toEqual(['https://admin.denly.app', 'http://localhost:8081']);
  });
});
