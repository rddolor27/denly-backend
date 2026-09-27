import { describe, expect, it } from 'vitest';
import type {
  CatalogIngredient,
  IntelligenceDetection,
} from '../models/structured-ingredient-data.model.js';
import { mapToCatalog } from './map-to-catalog.js';

const egg: CatalogIngredient = {
  id: 'ing-egg',
  slug: 'egg',
  canonicalName: 'Egg',
  category: 'protein',
  allergens: ['egg'],
  dietaryFlags: [],
};

function detection(
  overrides: Partial<IntelligenceDetection> = {},
): IntelligenceDetection {
  return { id: 'd1', className: 'egg', confidence: 0.5, ...overrides };
}

describe('mapToCatalog', () => {
  it('maps a detection whose class is in the catalog', () => {
    const catalog = new Map([['egg', egg]]);
    const result = mapToCatalog([detection()], catalog);
    expect(result.mapped).toEqual([
      { detection: detection(), ingredient: egg },
    ]);
    expect(result.unmapped).toHaveLength(0);
  });

  it('reports a class with no catalog entry as unmapped, never guessed', () => {
    const catalog = new Map<string, CatalogIngredient>();
    const unknown = detection({ className: 'mystery_powder' });
    const result = mapToCatalog([unknown], catalog);
    expect(result.mapped).toHaveLength(0);
    expect(result.unmapped).toEqual([unknown]);
  });
});
