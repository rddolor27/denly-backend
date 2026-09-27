import { describe, expect, it } from 'vitest';
import { buildCorsOptions } from './cors.js';

const ALLOWED = 'https://admin.denly.app';

function decide(
  origins: readonly string[],
  requestOrigin: string | undefined,
): { error: Error | null; allow: unknown } {
  const { origin } = buildCorsOptions(origins);
  if (typeof origin !== 'function')
    throw new Error('expected an origin callback');
  let result: { error: Error | null; allow: unknown } | undefined;
  origin(requestOrigin, (error, allow) => {
    result = { error, allow };
  });
  if (result === undefined) throw new Error('callback was not called');
  return result;
}

describe('buildCorsOptions', () => {
  it('allows requests without an Origin header (mobile app, curl, probes)', () => {
    expect(decide([], undefined)).toEqual({ error: null, allow: true });
  });

  it('allows a listed origin', () => {
    expect(decide([ALLOWED], ALLOWED)).toEqual({ error: null, allow: true });
  });

  it.each([
    'https://evil.example',
    'https://admin.denly.app.evil.example',
    'http://admin.denly.app',
    'null',
    '',
  ])('denies %j without an error', (requestOrigin) => {
    expect(decide([ALLOWED], requestOrigin)).toEqual({
      error: null,
      allow: false,
    });
  });

  it('denies every browser origin when none is configured', () => {
    expect(decide([], ALLOWED)).toEqual({ error: null, allow: false });
  });

  it('uses bearer-token settings: no credentials, fixed methods and headers', () => {
    const { origin: _origin, ...rest } = buildCorsOptions([ALLOWED]);
    expect(rest).toEqual({
      credentials: false,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'x-request-id'],
      exposedHeaders: ['x-request-id'],
      maxAge: 600,
    });
  });
});
