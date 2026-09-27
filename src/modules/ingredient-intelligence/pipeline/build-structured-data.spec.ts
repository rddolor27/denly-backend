import { describe, expect, it } from 'vitest';
import type { RulesBundle } from '../models/rules-bundle.model.js';
import type {
  CatalogIngredient,
  IntelligenceDetection,
} from '../models/structured-ingredient-data.model.js';
import { buildStructuredData } from './build-structured-data.js';

const egg: CatalogIngredient = {
  id: 'ing-egg',
  slug: 'egg',
  canonicalName: 'Egg',
  category: 'protein',
  allergens: ['egg'],
  dietaryFlags: ['vegetarian'],
};
const tomato: CatalogIngredient = {
  id: 'ing-tomato',
  slug: 'tomato',
  canonicalName: 'Tomato',
  category: 'fruit_veg',
  allergens: [],
  dietaryFlags: ['vegan', 'vegetarian'],
};
const shrimp: CatalogIngredient = {
  id: 'ing-shrimp',
  slug: 'shrimp',
  canonicalName: 'Shrimp',
  category: 'seafood',
  allergens: ['crustacean_shellfish'],
  dietaryFlags: [],
};
const tofu: CatalogIngredient = {
  id: 'ing-tofu',
  slug: 'tofu',
  canonicalName: 'Tofu',
  category: 'protein',
  allergens: ['soy'],
  dietaryFlags: ['vegan', 'vegetarian'],
};

const catalog = new Map<string, CatalogIngredient>([
  ['egg', egg],
  ['tomato', tomato],
  ['shrimp', shrimp],
  ['tofu', tofu],
]);

const bundle: RulesBundle = {
  rulesVersion: 'rules-test-1',
  confidenceFloor: 0.25,
  classFloors: {},
  bands: { high: 0.7, medium: 0.45 },
  rules: [
    {
      id: 'contains-egg',
      reason: 'Egg is a major allergen.',
      when: { kind: 'anyAllergen', values: ['egg'] },
      then: [{ kind: 'addFlag', flag: 'contains_egg' }],
    },
    {
      id: 'contains-crustacean-shellfish',
      reason: 'Crustacean shellfish is a major allergen.',
      when: { kind: 'anyAllergen', values: ['crustacean_shellfish'] },
      then: [
        { kind: 'addFlag', flag: 'contains_crustacean_shellfish' },
        { kind: 'lowerBand' },
      ],
    },
  ],
};

function detection(
  overrides: Partial<IntelligenceDetection> = {},
): IntelligenceDetection {
  return { id: 'd0', className: 'egg', confidence: 0.5, ...overrides };
}

describe('buildStructuredData', () => {
  it('runs the full pipeline end to end on a hand-built fixture', () => {
    const detections: IntelligenceDetection[] = [
      detection({ id: 'd1', className: 'egg', confidence: 0.8 }),
      detection({ id: 'd2', className: 'tomato', confidence: 0.9 }),
      detection({ id: 'd3', className: 'shrimp', confidence: 0.75 }),
      detection({ id: 'd4', className: 'tofu', confidence: 0.5 }),
      detection({ id: 'd5', className: 'seaweed', confidence: 0.6 }), // unknown class
      detection({ id: 'd6', className: 'egg', confidence: 0.1 }), // below floor, dropped
    ];

    const result = buildStructuredData(
      { scanId: 'scan-1', detections },
      catalog,
      bundle,
    );

    expect(result).toEqual({
      scanId: 'scan-1',
      rulesVersion: 'rules-test-1',
      flags: ['contains_crustacean_shellfish', 'contains_egg'],
      ingredients: [
        {
          ingredientId: 'ing-tomato',
          slug: 'tomato',
          canonicalName: 'Tomato',
          category: 'fruit_veg',
          confidence: 0.9,
          confidenceBand: 'high',
          detectionIds: ['d2'],
          metadata: { allergens: [] },
          dietaryFlags: ['vegan', 'vegetarian'],
          ruleHits: [],
        },
        {
          ingredientId: 'ing-egg',
          slug: 'egg',
          canonicalName: 'Egg',
          category: 'protein',
          confidence: 0.8,
          confidenceBand: 'high',
          detectionIds: ['d1'],
          metadata: { allergens: ['egg'] },
          dietaryFlags: ['vegetarian'],
          ruleHits: ['contains-egg'],
        },
        {
          ingredientId: 'ing-shrimp',
          slug: 'shrimp',
          canonicalName: 'Shrimp',
          category: 'seafood',
          confidence: 0.75,
          // started 'high' (>= 0.7) but the shellfish rule lowers it one step
          confidenceBand: 'medium',
          detectionIds: ['d3'],
          metadata: { allergens: ['crustacean_shellfish'] },
          dietaryFlags: [],
          ruleHits: ['contains-crustacean-shellfish'],
        },
        {
          ingredientId: 'ing-tofu',
          slug: 'tofu',
          canonicalName: 'Tofu',
          category: 'protein',
          confidence: 0.5,
          confidenceBand: 'medium',
          detectionIds: ['d4'],
          metadata: { allergens: ['soy'] },
          dietaryFlags: ['vegan', 'vegetarian'],
          ruleHits: [],
        },
      ],
      unknowns: [
        { className: 'seaweed', confidence: 0.6, detectionIds: ['d5'] },
      ],
    });
  });

  it('is deterministic: identical input twice deep-equals, shuffled input deep-equals', () => {
    const d1 = detection({ id: 'd1', className: 'egg', confidence: 0.8 });
    const d2 = detection({ id: 'd2', className: 'tomato', confidence: 0.9 });
    const d3 = detection({ id: 'd3', className: 'shrimp', confidence: 0.75 });
    const d4 = detection({ id: 'd4', className: 'seaweed', confidence: 0.6 });
    const detections: IntelligenceDetection[] = [d1, d2, d3, d4];
    const shuffled: IntelligenceDetection[] = [d4, d2, d3, d1];

    const first = buildStructuredData(
      { scanId: 'scan-1', detections },
      catalog,
      bundle,
    );
    const second = buildStructuredData(
      { scanId: 'scan-1', detections },
      catalog,
      bundle,
    );
    const fromShuffled = buildStructuredData(
      { scanId: 'scan-1', detections: shuffled },
      catalog,
      bundle,
    );

    expect(second).toEqual(first);
    expect(fromShuffled).toEqual(first);
  });

  it('never mutates the input detections array', () => {
    const detections: IntelligenceDetection[] = [detection()];
    const before = structuredClone(detections);
    buildStructuredData({ scanId: 'scan-1', detections }, catalog, bundle);
    expect(detections).toEqual(before);
  });
});
