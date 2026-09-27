import { describe, expect, it } from 'vitest';
import { bandFor } from './band.js';

describe('bandFor', () => {
  const bands = { high: 0.7, medium: 0.45 };

  it('is high at and above the high threshold', () => {
    expect(bandFor(0.7, bands)).toBe('high');
    expect(bandFor(0.95, bands)).toBe('high');
  });

  it('is medium at the medium threshold and below the high threshold', () => {
    expect(bandFor(0.45, bands)).toBe('medium');
    expect(bandFor(0.69, bands)).toBe('medium');
  });

  it('is low below the medium threshold', () => {
    expect(bandFor(0.44, bands)).toBe('low');
    expect(bandFor(0, bands)).toBe('low');
  });
});
