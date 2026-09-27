import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

export const CORS_ALLOWED_METHODS = [
  'GET',
  'POST',
  'PATCH',
  'PUT',
  'DELETE',
  'OPTIONS',
] as const;
export const CORS_ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'x-request-id',
] as const;
export const CORS_EXPOSED_HEADERS = ['x-request-id'] as const;
export const CORS_MAX_AGE_SECONDS = 600;

type OriginCallback = (err: Error | null, allow?: boolean) => void;

/**
 * CORS for browsers only — the mobile app, curl and health probes send no `Origin` and are always
 * let through. A browser origin gets CORS headers only if it is listed exactly; any other origin
 * gets none (`callback(null, false)`), so the browser blocks the response while the server
 * answers normally — never an error or a 500. No credentials: auth is a bearer header, not cookies.
 */
export function buildCorsOptions(origins: readonly string[]): CorsOptions {
  const allowed = new Set(origins);
  return {
    origin: (requestOrigin: string | undefined, callback: OriginCallback) => {
      callback(null, requestOrigin === undefined || allowed.has(requestOrigin));
    },
    credentials: false,
    methods: [...CORS_ALLOWED_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    exposedHeaders: [...CORS_EXPOSED_HEADERS],
    maxAge: CORS_MAX_AGE_SECONDS,
  };
}
