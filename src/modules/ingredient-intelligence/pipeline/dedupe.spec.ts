import { describe, expect, it } from 'vitest';
import type {
  CatalogIngredient,
  IntelligenceDetection,
} from '../models/structured-ingredient-data.model.js';
import { dedupe } from './dedupe.js';
import type { MappedDetection } from './pipeline-types.js';

const egg: CatalogIngredient = {
  id: 'ing-egg',
  slug: 'egg',
  canonicalName: 'Egg',
  category: 'protein',
  allergens: ['egg'],
  dietaryFlags: [],
};

describe('dedupe', () => {
  it('groups mapped detections by ingredient id, keeping the max confidence and every id', () => {
    const mapped: MappedDetection[] = [
      {
        detection: { id: 'z', className: 'egg', confidence: 0.4 },
        ingredient: egg,
      },
      {
        detection: { id: 'a', className: 'egg', confidence: 0.9 },
        ingredient: egg,
      },
    ];
    const result = dedupe(mapped, []);
    expect(result.ingredients).toHaveLength(1);
    expect(result.ingredients[0]).toEqual({
      ingredient: egg,
      confidence: 0.9,
      detectionIds: ['a', 'z'],
    });
  });

  it('groups unmapped detections by className the same way', () => {
    const unmapped: IntelligenceDetection[] = [
      { id: 'z', className: 'mystery', confidence: 0.2 },
      { id: 'a', className: 'mystery', confidence: 0.7 },
    ];
    const result = dedupe([], unmapped);
    expect(result.unknowns).toEqual([
      { className: 'mystery', confidence: 0.7, detectionIds: ['a', 'z'] },
    ]);
  });

  it('keeps distinct ingredients and classNames separate', () => {
    const tofu: CatalogIngredient = { ...egg, id: 'ing-tofu', slug: 'tofu' };
    const mapped: MappedDetection[] = [
      {
        detection: { id: 'd1', className: 'egg', confidence: 0.5 },
        ingredient: egg,
      },
      {
        detection: { id: 'd2', className: 'tofu', confidence: 0.6 },
        ingredient: tofu,
      },
    ];
    const result = dedupe(mapped, []);
    expect(result.ingredients).toHaveLength(2);
  });

  it('never mutates its inputs', () => {
    const mapped: MappedDetection[] = [
      {
        detection: { id: 'd1', className: 'egg', confidence: 0.5 },
        ingredient: egg,
      },
    ];
    const mappedCopy = structuredClone(mapped);
    dedupe(mapped, []);
    expect(mapped).toEqual(mappedCopy);
  });
});
