import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

interface ScryptParams {
  readonly log2N: number;
  readonly r: number;
  readonly p: number;
}

interface StoredHash {
  readonly params: ScryptParams;
  readonly salt: Buffer;
  readonly hash: Buffer;
}

const CURRENT_PARAMS: ScryptParams = { log2N: 15, r: 8, p: 3 };
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MAX_MEMORY = 64 * 1024 * 1024;
const STORED_HASH_PATTERN =
  /^scrypt\$(\d{1,2})\$(\d{1,3})\$(\d{1,3})\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

function deriveKey(
  password: string,
  salt: Buffer,
  params: ScryptParams,
  keyLength: number,
): Promise<Buffer> {
  const options = {
    N: 2 ** params.log2N,
    r: params.r,
    p: params.p,
    maxmem: MAX_MEMORY,
  };
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function parseStoredHash(stored: string): StoredHash | null {
  const match = STORED_HASH_PATTERN.exec(stored);
  if (!match) return null;
  const [, log2N, r, p, salt, hash] = match;
  if (!log2N || !r || !p || !salt || !hash) return null;
  const params = { log2N: Number(log2N), r: Number(r), p: Number(p) };
  if (params.log2N < 1 || params.r < 1 || params.p < 1) return null;
  const saltBytes = Buffer.from(salt, 'base64url');
  const hashBytes = Buffer.from(hash, 'base64url');
  if (saltBytes.length === 0 || hashBytes.length === 0) return null;
  return { params, salt: saltBytes, hash: hashBytes };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await deriveKey(password, salt, CURRENT_PARAMS, KEY_LENGTH);
  const { log2N, r, p } = CURRENT_PARAMS;
  return `scrypt$${log2N}$${r}$${p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;
  const actual = await deriveKey(
    password,
    parsed.salt,
    parsed.params,
    parsed.hash.length,
  );
  return timingSafeEqual(actual, parsed.hash);
}

let dummyHash: Promise<string> | undefined;

// Login verifies unknown emails against this so both rejections cost the same scrypt work.
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(
    randomBytes(SALT_BYTES).toString('base64url'),
  ).catch((error: unknown) => {
    dummyHash = undefined;
    throw error;
  });
  return dummyHash;
}
