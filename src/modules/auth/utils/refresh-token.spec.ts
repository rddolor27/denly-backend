import { describe, expect, it } from 'vitest';
import { REFRESH_TOKEN_PATTERN } from '../constants/auth.constants.js';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.js';

describe('refresh token', () => {
  it('generates 43-character base64url tokens that match the request pattern', () => {
    const token = generateRefreshToken();

    expect(token).toHaveLength(43);
    expect(token).toMatch(REFRESH_TOKEN_PATTERN);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('generates a different token every time', () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => generateRefreshToken()),
    );

    expect(tokens.size).toBe(100);
  });

  it('hashes a token to a deterministic SHA-256 hex digest', () => {
    const token = 'A'.repeat(43);

    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(token)).not.toBe(hashRefreshToken('B'.repeat(43)));
  });

  it('matches the known SHA-256 digest', () => {
    expect(hashRefreshToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
