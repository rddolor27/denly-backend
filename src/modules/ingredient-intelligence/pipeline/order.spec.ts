import { describe, expect, it } from 'vitest';
import type {
  StructuredIngredient,
  UnknownDetection,
} from '../models/structured-ingredient-data.model.js';
import { orderResults } from './order.js';

function ingredient(
  overrides: Partial<StructuredIngredient>,
): StructuredIngredient {
  return {
    ingredientId: 'id',
    slug: 'slug',
    canonicalName: 'Name',
    category: 'other',
    confidence: 0.5,
    confidenceBand: 'medium',
    detectionIds: [],
    metadata: { allergens: [] },
    dietaryFlags: [],
    ruleHits: [],
    ...overrides,
  };
}

describe('orderResults', () => {
  it('orders ingredients by confidence desc, then canonicalName asc', () => {
    const a = ingredient({ canonicalName: 'Zucchini', confidence: 0.9 });
    const b = ingredient({ canonicalName: 'Apple', confidence: 0.9 });
    const c = ingredient({ canonicalName: 'Banana', confidence: 0.2 });
    const result = orderResults([c, a, b], [], []);
    expect(result.ingredients.map((i) => i.canonicalName)).toEqual([
      'Apple',
      'Zucchini',
      'Banana',
    ]);
  });

  it('orders unknowns by confidence desc, then className asc', () => {
    const unknowns: UnknownDetection[] = [
      { className: 'zeta', confidence: 0.3, detectionIds: [] },
      { className: 'alpha', confidence: 0.3, detectionIds: [] },
      { className: 'beta', confidence: 0.9, detectionIds: [] },
    ];
    const result = orderResults([], unknowns, []);
    expect(result.unknowns.map((u) => u.className)).toEqual([
      'beta',
      'alpha',
      'zeta',
    ]);
  });

  it('sorts flags ascending', () => {
    const result = orderResults([], [], ['contains_soy', 'contains_egg']);
    expect(result.flags).toEqual(['contains_egg', 'contains_soy']);
  });

  it('never mutates the input arrays', () => {
    const ingredients = [
      ingredient({ canonicalName: 'B' }),
      ingredient({ canonicalName: 'A' }),
    ];
    const copy = [...ingredients];
    orderResults(ingredients, [], []);
    expect(ingredients).toEqual(copy);
  });
});
