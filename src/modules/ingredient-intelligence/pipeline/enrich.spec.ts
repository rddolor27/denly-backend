import { describe, expect, it } from 'vitest';
import type { CatalogIngredient } from '../models/structured-ingredient-data.model.js';
import { enrichIngredients } from './enrich.js';
import type { DedupedIngredient } from './pipeline-types.js';

const egg: CatalogIngredient = {
  id: 'ing-egg',
  slug: 'egg',
  canonicalName: 'Egg',
  category: 'protein',
  allergens: ['egg'],
  dietaryFlags: ['vegetarian'],
};

describe('enrichIngredients', () => {
  it('attaches catalog metadata and starts with no rule hits', () => {
    const deduped: DedupedIngredient[] = [
      { ingredient: egg, confidence: 0.8, detectionIds: ['d1'] },
    ];
    const [enriched] = enrichIngredients(deduped);
    expect(enriched).toEqual({
      ingredientId: 'ing-egg',
      slug: 'egg',
      canonicalName: 'Egg',
      category: 'protein',
      confidence: 0.8,
      detectionIds: ['d1'],
      metadata: { allergens: ['egg'] },
      dietaryFlags: ['vegetarian'],
      ruleHits: [],
    });
  });
});
