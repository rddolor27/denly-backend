import { describe, expect, it } from 'vitest';
import type { Rule } from '../models/rules-bundle.model.js';
import type { StructuredIngredient } from '../models/structured-ingredient-data.model.js';
import { applyRules } from './rules.js';

function ingredient(
  overrides: Partial<StructuredIngredient>,
): StructuredIngredient {
  return {
    ingredientId: 'id',
    slug: 'slug',
    canonicalName: 'Name',
    category: 'other',
    confidence: 0.9,
    confidenceBand: 'high',
    detectionIds: [],
    metadata: { allergens: [] },
    dietaryFlags: [],
    ruleHits: [],
    ...overrides,
  };
}

describe('applyRules', () => {
  it('matches anySlug and adds a flag without changing the band', () => {
    const egg = ingredient({ slug: 'egg' });
    const rule: Rule = {
      id: 'r1',
      reason: 'test',
      when: { kind: 'anySlug', values: ['egg'] },
      then: [{ kind: 'addFlag', flag: 'contains_egg' }],
    };
    const result = applyRules([egg], [rule]);
    expect(result.flags).toEqual(['contains_egg']);
    expect(result.ingredients[0]?.confidenceBand).toBe('high');
    expect(result.ingredients[0]?.ruleHits).toEqual(['r1']);
  });

  it('matches anyCategory', () => {
    const meat = ingredient({ category: 'meat' });
    const rule: Rule = {
      id: 'contains-meat',
      reason: 'test',
      when: { kind: 'anyCategory', values: ['meat'] },
      then: [{ kind: 'addFlag', flag: 'contains_meat' }],
    };
    const result = applyRules([meat], [rule]);
    expect(result.flags).toEqual(['contains_meat']);
  });

  it('matches anyAllergen', () => {
    const shrimp = ingredient({
      metadata: { allergens: ['crustacean_shellfish'] },
    });
    const rule: Rule = {
      id: 'contains-shellfish',
      reason: 'test',
      when: { kind: 'anyAllergen', values: ['crustacean_shellfish'] },
      then: [{ kind: 'addFlag', flag: 'contains_crustacean_shellfish' }],
    };
    const result = applyRules([shrimp], [rule]);
    expect(result.flags).toEqual(['contains_crustacean_shellfish']);
  });

  it('allSlugs fires only when every value is the slug of some ingredient (full match)', () => {
    const egg = ingredient({ ingredientId: 'egg-id', slug: 'egg' });
    const flour = ingredient({ ingredientId: 'flour-id', slug: 'flour' });
    const rule: Rule = {
      id: 'egg-and-flour',
      reason: 'test',
      when: { kind: 'allSlugs', values: ['egg', 'flour'] },
      then: [{ kind: 'addFlag', flag: 'baked_good' }],
    };
    const result = applyRules([egg, flour], [rule]);
    expect(result.flags).toEqual(['baked_good']);
    expect(
      result.ingredients.every((i) => i.ruleHits.includes('egg-and-flour')),
    ).toBe(true);
  });

  it('allSlugs never fires on a partial match', () => {
    const egg = ingredient({ ingredientId: 'egg-id', slug: 'egg' });
    const rule: Rule = {
      id: 'egg-and-flour',
      reason: 'test',
      when: { kind: 'allSlugs', values: ['egg', 'flour'] },
      then: [{ kind: 'addFlag', flag: 'baked_good' }],
    };
    const result = applyRules([egg], [rule]);
    expect(result.flags).toEqual([]);
    expect(result.ingredients[0]?.ruleHits).toEqual([]);
  });

  it('lowerBand steps high -> medium -> low, and low stays low', () => {
    const high = ingredient({
      ingredientId: 'a',
      slug: 'a',
      confidenceBand: 'high',
    });
    const rule: Rule = {
      id: 'lower',
      reason: 'test',
      when: { kind: 'anySlug', values: ['a'] },
      then: [{ kind: 'lowerBand' }],
    };
    const oneStep = applyRules([high], [rule]);
    expect(oneStep.ingredients[0]?.confidenceBand).toBe('medium');

    const twoRules = [rule, { ...rule, id: 'lower-2' }];
    const twoSteps = applyRules([high], twoRules);
    expect(twoSteps.ingredients[0]?.confidenceBand).toBe('low');

    const low = ingredient({
      ingredientId: 'b',
      slug: 'b',
      confidenceBand: 'low',
    });
    const stillLow = applyRules(
      [low],
      [{ ...rule, when: { kind: 'anySlug', values: ['b'] } }],
    );
    expect(stillLow.ingredients[0]?.confidenceBand).toBe('low');
  });

  it('a rule with no matches never fires and never adds an ingredient', () => {
    const egg = ingredient({ slug: 'egg' });
    const rule: Rule = {
      id: 'no-match',
      reason: 'test',
      when: { kind: 'anySlug', values: ['does-not-exist'] },
      then: [{ kind: 'addFlag', flag: 'should_not_appear' }],
    };
    const result = applyRules([egg], [rule]);
    expect(result.ingredients).toHaveLength(1);
    expect(result.flags).toEqual([]);
    expect(result.ingredients[0]?.ruleHits).toEqual([]);
  });

  it('appends a matching rule id to ruleHits only once even with multiple actions', () => {
    const egg = ingredient({ slug: 'egg' });
    const rule: Rule = {
      id: 'multi-action',
      reason: 'test',
      when: { kind: 'anySlug', values: ['egg'] },
      then: [
        { kind: 'addFlag', flag: 'a' },
        { kind: 'addFlag', flag: 'b' },
      ],
    };
    const result = applyRules([egg], [rule]);
    expect(result.ingredients[0]?.ruleHits).toEqual(['multi-action']);
  });

  it('never mutates the input ingredients', () => {
    const egg = ingredient({ slug: 'egg' });
    const before = structuredClone(egg);
    const rule: Rule = {
      id: 'r1',
      reason: 'test',
      when: { kind: 'anySlug', values: ['egg'] },
      then: [{ kind: 'lowerBand' }],
    };
    applyRules([egg], [rule]);
    expect(egg).toEqual(before);
  });
});
