import { describe, expect, it } from 'vitest';
import { normalizeAlias } from './normalize-alias.js';

describe('normalizeAlias', () => {
  it.each([
    ['Sweet_Potato', 'sweet potato'],
    ["Bird's eye chili", 'birds eye chili'],
    ['luy-a', 'luy-a'],
    ['  Kamatís ', 'kamatis'],
  ])('matches the documented examples: %j -> %j', (input, expected) => {
    expect(normalizeAlias(input)).toBe(expected);
  });

  it('lower-cases', () => {
    expect(normalizeAlias('GREEN Onion')).toBe('green onion');
  });

  it('collapses whitespace runs, tabs and newlines into one space and trims', () => {
    expect(normalizeAlias(' \t red   onion\n')).toBe('red onion');
  });

  it('strips diacritics', () => {
    expect(normalizeAlias('Jalapeño Crème Brûlée')).toBe(
      'jalapeno creme brulee',
    );
  });

  it('folds compatibility forms (NFKC) before lower-casing', () => {
    expect(normalizeAlias('ＴＯＦＵ')).toBe('tofu');
    expect(normalizeAlias('ﬁg')).toBe('fig');
  });

  it('turns underscores into spaces', () => {
    expect(normalizeAlias('sweet_potato_leaves')).toBe('sweet potato leaves');
    expect(normalizeAlias('__egg__')).toBe('egg');
  });

  it('drops apostrophes and other punctuation without adding a space', () => {
    expect(normalizeAlias("lady's finger")).toBe('ladys finger');
    expect(normalizeAlias('chili (vegetable)!')).toBe('chili vegetable');
  });

  it('keeps digits and non-Latin letters', () => {
    expect(normalizeAlias('7 Up')).toBe('7 up');
    expect(normalizeAlias('豆腐')).toBe('豆腐');
  });

  it('keeps a hyphen between two letters or digits', () => {
    expect(normalizeAlias('kan-on')).toBe('kan-on');
    expect(normalizeAlias('1-2')).toBe('1-2');
  });

  it('removes leading, trailing and space-adjacent hyphens', () => {
    expect(normalizeAlias('-abc')).toBe('abc');
    expect(normalizeAlias('abc-')).toBe('abc');
    expect(normalizeAlias('a -b')).toBe('a b');
    expect(normalizeAlias('a - b')).toBe('a b');
    expect(normalizeAlias(' - ')).toBe('');
  });

  it('removes repeated hyphens', () => {
    expect(normalizeAlias('a--b')).toBe('ab');
  });

  it('returns an empty string for input with nothing left', () => {
    expect(normalizeAlias('')).toBe('');
    expect(normalizeAlias("  '!_  ")).toBe('');
  });

  it('is idempotent', () => {
    const inputs = [
      'Sweet_Potato',
      "Bird's eye chili",
      '  Kamatís ',
      'a -b',
      'a--b',
      'İstanbul',
      '한국 배추',
      'ＴＯＦＵ-',
    ];
    for (const input of inputs) {
      const once = normalizeAlias(input);
      expect(normalizeAlias(once)).toBe(once);
    }
  });
});
