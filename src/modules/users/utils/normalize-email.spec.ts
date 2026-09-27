import { describe, expect, it } from 'vitest';
import { normalizeEmail } from './normalize-email.js';

describe('normalizeEmail', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeEmail(' \tana@example.com\n')).toBe('ana@example.com');
  });

  it('lower-cases the whole address', () => {
    expect(normalizeEmail('Ana.Cruz@Example.COM')).toBe('ana.cruz@example.com');
  });

  it('leaves an already normalised address unchanged', () => {
    expect(normalizeEmail('ana@example.com')).toBe('ana@example.com');
  });
});
