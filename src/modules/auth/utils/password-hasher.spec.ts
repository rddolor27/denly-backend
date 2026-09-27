import { scryptSync } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  dummyPasswordHash,
  hashPassword,
  verifyPassword,
} from './password-hasher.js';

const PASSWORD = 'correct horse battery staple';

describe('password hasher', () => {
  let stored: string;

  beforeAll(async () => {
    stored = await hashPassword(PASSWORD);
  });

  it('stores the scrypt parameters, a 16-byte salt and a 64-byte hash', () => {
    const parts = stored.split('$');

    expect(parts.slice(0, 4)).toEqual(['scrypt', '15', '8', '3']);
    expect(Buffer.from(parts[4] ?? '', 'base64url')).toHaveLength(16);
    expect(Buffer.from(parts[5] ?? '', 'base64url')).toHaveLength(64);
  });

  it('verifies the password it hashed', async () => {
    await expect(verifyPassword(PASSWORD, stored)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    await expect(
      verifyPassword('correct horse battery stapl', stored),
    ).resolves.toBe(false);
    await expect(verifyPassword(PASSWORD.toUpperCase(), stored)).resolves.toBe(
      false,
    );
  });

  it('salts every hash differently', async () => {
    const again = await hashPassword(PASSWORD);

    expect(again).not.toBe(stored);
    await expect(verifyPassword(PASSWORD, again)).resolves.toBe(true);
  });

  it('verifies with the parameters recorded in the stored string', async () => {
    const salt = Buffer.from('0123456789abcdef');
    const hash = scryptSync(PASSWORD, salt, 32, { N: 2 ** 10, r: 4, p: 1 });
    const legacy = `scrypt$10$4$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;

    await expect(verifyPassword(PASSWORD, legacy)).resolves.toBe(true);
    await expect(verifyPassword('other password', legacy)).resolves.toBe(false);
  });

  it.each([
    [''],
    ['not-a-hash'],
    ['bcrypt$15$8$3$c2FsdA$aGFzaA'],
    ['scrypt$15$8$3$c2FsdA'],
    ['scrypt$x$8$3$c2FsdA$aGFzaA'],
    ['scrypt$0$8$3$c2FsdA$aGFzaA'],
    ['scrypt$15$0$3$c2FsdA$aGFzaA'],
    ['scrypt$15$8$0$c2FsdA$aGFzaA'],
    ['scrypt$15$8$3$c2Fs+dA$aGFzaA'],
    ['scrypt$15$8$3$c2FsdA$A'],
    ['scrypt$15$8$3$c2FsdA$aGFzaA$extra'],
  ])('returns false for the malformed stored hash %j', async (malformed) => {
    await expect(verifyPassword(PASSWORD, malformed)).resolves.toBe(false);
  });

  it('computes one well-formed dummy hash and reuses it', async () => {
    const first = await dummyPasswordHash();
    const second = await dummyPasswordHash();

    expect(first).toMatch(/^scrypt\$15\$8\$3\$/);
    expect(second).toBe(first);
    await expect(verifyPassword(PASSWORD, first)).resolves.toBe(false);
  });
});
