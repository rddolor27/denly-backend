import { describe, expect, it } from 'vitest';
import { compareStrings } from './compare-strings.js';

describe('compareStrings', () => {
  it('orders by UTF-16 code unit, not locale', () => {
    expect(compareStrings('a', 'b')).toBeLessThan(0);
    expect(compareStrings('b', 'a')).toBeGreaterThan(0);
    expect(compareStrings('a', 'a')).toBe(0);
    // "Z" (0x5A) sorts before "a" (0x61) ordinally — a locale compare would disagree.
    expect(compareStrings('Z', 'a')).toBeLessThan(0);
  });
});
