import { describe, expect, it } from 'vitest';
import { InvalidScanCursorError } from '../errors/scans.errors.js';
import { decodeScanCursor, encodeScanCursor } from './scan-cursor.js';

describe('scan cursor', () => {
  const cursor = {
    createdAt: new Date('2026-09-23T12:34:56.789Z'),
    id: '6f1c1b8e-8d8e-4c7a-9c1e-1b2d3c4e5f60',
  };

  it('round-trips a cursor exactly', () => {
    expect(decodeScanCursor(encodeScanCursor(cursor))).toEqual(cursor);
  });

  it('is opaque url-safe text', () => {
    expect(encodeScanCursor(cursor)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['garbage', 'not-a-cursor'],
    [
      'missing id',
      Buffer.from('2026-09-23T12:34:56.789Z').toString('base64url'),
    ],
    [
      'bad date',
      Buffer.from('yesterday|6f1c1b8e-8d8e-4c7a-9c1e-1b2d3c4e5f60').toString(
        'base64url',
      ),
    ],
    [
      'bad id',
      Buffer.from('2026-09-23T12:34:56.789Z|42').toString('base64url'),
    ],
    [
      'extra part',
      Buffer.from(
        '2026-09-23T12:34:56.789Z|6f1c1b8e-8d8e-4c7a-9c1e-1b2d3c4e5f60|x',
      ).toString('base64url'),
    ],
  ])('rejects %s', (_label, value) => {
    expect(() => decodeScanCursor(value)).toThrow(InvalidScanCursorError);
  });
});
