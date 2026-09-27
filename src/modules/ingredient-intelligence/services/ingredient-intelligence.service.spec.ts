import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IIngredientsService } from '@/modules/ingredients/interfaces/ingredients-service.interface.js';
import type { IngredientModel } from '@/modules/ingredients/models/ingredient.model.js';
import type { RulesBundle } from '../models/rules-bundle.model.js';
import { IngredientIntelligenceService } from './ingredient-intelligence.service.js';

function ingredientModel(
  overrides: Partial<IngredientModel> = {},
): IngredientModel {
  return {
    id: 'ing-egg',
    slug: 'egg',
    canonicalName: 'Egg',
    category: 'protein',
    metadata: { taxonomyClassId: 1, tier: 'A', allergens: ['egg'] },
    dietaryFlags: ['vegetarian'],
    aliases: [],
    ...overrides,
  };
}

function bundle(): RulesBundle {
  return {
    rulesVersion: 'rules-test-1',
    confidenceFloor: 0.25,
    classFloors: {},
    bands: { high: 0.7, medium: 0.45 },
    rules: [],
  };
}

describe('IngredientIntelligenceService', () => {
  let ingredientsMock: {
    list: ReturnType<typeof vi.fn>;
    findBySlug: ReturnType<typeof vi.fn>;
    resolveModelClasses: ReturnType<typeof vi.fn>;
  };
  let service: IngredientIntelligenceService;
  let rulesBundle: RulesBundle;

  beforeEach(() => {
    ingredientsMock = {
      list: vi.fn(),
      findBySlug: vi.fn(),
      resolveModelClasses: vi.fn(),
    };
    rulesBundle = bundle();
    service = new IngredientIntelligenceService(
      rulesBundle,
      ingredientsMock as unknown as IIngredientsService,
    );
  });

  it('exposes the bundle rulesVersion', () => {
    expect(service.rulesVersion).toBe('rules-test-1');
  });

  it('resolves distinct class names once and maps them into the catalog', async () => {
    ingredientsMock.resolveModelClasses.mockResolvedValue(
      new Map([['egg', ingredientModel()]]),
    );

    const result = await service.build('scan-1', [
      { id: 'd1', className: 'egg', confidence: 0.8 },
      { id: 'd2', className: 'egg', confidence: 0.9 },
    ]);

    expect(ingredientsMock.resolveModelClasses).toHaveBeenCalledTimes(1);
    expect(ingredientsMock.resolveModelClasses).toHaveBeenCalledWith(['egg']);
    expect(result.scanId).toBe('scan-1');
    expect(result.rulesVersion).toBe('rules-test-1');
    expect(result.ingredients).toHaveLength(1);
    expect(result.ingredients[0]?.metadata.allergens).toEqual(['egg']);
  });

  it('reports an unresolved class as an unknown', async () => {
    ingredientsMock.resolveModelClasses.mockResolvedValue(new Map());

    const result = await service.build('scan-1', [
      { id: 'd1', className: 'mystery', confidence: 0.9 },
    ]);

    expect(result.unknowns).toEqual([
      { className: 'mystery', confidence: 0.9, detectionIds: ['d1'] },
    ]);
  });
});
