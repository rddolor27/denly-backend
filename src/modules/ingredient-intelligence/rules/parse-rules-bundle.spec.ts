import { describe, expect, it } from 'vitest';
import { InvalidRulesBundleError } from '../errors/ingredient-intelligence.errors.js';
import shippedRulesBundle from '../data/rules-bundle.json' with { type: 'json' };
import { parseRulesBundle } from './parse-rules-bundle.js';

interface TestBundle {
  rulesVersion: string;
  confidenceFloor: number;
  classFloors: Record<string, number>;
  bands: { high: number; medium: number };
  rules: Record<string, unknown>[];
}

function validBundle(): TestBundle {
  return {
    rulesVersion: 'rules-test-1',
    confidenceFloor: 0.25,
    classFloors: { egg: 0.3 },
    bands: { high: 0.7, medium: 0.45 },
    rules: [
      {
        id: 'contains-egg',
        reason: 'Egg is a major allergen.',
        when: { kind: 'anyAllergen', values: ['egg'] },
        then: [{ kind: 'addFlag', flag: 'contains_egg' }],
      },
    ],
  };
}

/** Narrows the fixture's first rule without a non-null assertion; every fixture here has one. */
function firstRule(bundle: TestBundle): Record<string, unknown> {
  const [rule] = bundle.rules;
  if (!rule) {
    throw new Error('expected the fixture to have a first rule');
  }
  return rule;
}

describe('parseRulesBundle', () => {
  it('parses the shipped rules bundle', () => {
    expect(() => parseRulesBundle(shippedRulesBundle)).not.toThrow();
  });

  it('parses a well-formed bundle', () => {
    const bundle = parseRulesBundle(validBundle());
    expect(bundle.rulesVersion).toBe('rules-test-1');
    expect(bundle.rules).toHaveLength(1);
  });

  it('rejects a non-object value', () => {
    expect(() => parseRulesBundle(null)).toThrow(InvalidRulesBundleError);
    expect(() => parseRulesBundle('nope')).toThrow(InvalidRulesBundleError);
  });

  it('rejects an empty rulesVersion', () => {
    const bundle: TestBundle = { ...validBundle(), rulesVersion: '' };
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('rejects a confidenceFloor out of range', () => {
    const bundle: TestBundle = { ...validBundle(), confidenceFloor: 1.5 };
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('rejects a classFloors key that does not match the class name pattern', () => {
    const bundle: TestBundle = {
      ...validBundle(),
      classFloors: { NotValid: 0.5 },
    };
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('rejects a classFloors value out of range', () => {
    const bundle: TestBundle = { ...validBundle(), classFloors: { egg: 2 } };
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('rejects bands where medium exceeds high', () => {
    const bundle: TestBundle = {
      ...validBundle(),
      bands: { high: 0.4, medium: 0.6 },
    };
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('rejects bands below confidenceFloor', () => {
    const bundle: TestBundle = {
      ...validBundle(),
      confidenceFloor: 0.5,
      bands: { high: 0.7, medium: 0.45 },
    };
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('rejects rules that is not an array', () => {
    const bundle = { ...validBundle(), rules: {} };
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('rejects a rule id that does not match the id pattern', () => {
    const bundle = validBundle();
    firstRule(bundle).id = 'Not_Valid';
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('rejects duplicate rule ids', () => {
    const bundle = validBundle();
    bundle.rules.push({ ...firstRule(bundle) });
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('rejects an empty reason', () => {
    const bundle = validBundle();
    firstRule(bundle).reason = '';
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('rejects an unknown predicate kind', () => {
    const bundle = validBundle();
    firstRule(bundle).when = { kind: 'anyPlanet', values: ['egg'] };
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('rejects a predicate with an empty values array', () => {
    const bundle = validBundle();
    firstRule(bundle).when = { kind: 'anyAllergen', values: [] };
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('rejects an empty then array', () => {
    const bundle = validBundle();
    firstRule(bundle).then = [];
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('rejects an addFlag action with an invalid flag', () => {
    const bundle = validBundle();
    firstRule(bundle).then = [{ kind: 'addFlag', flag: 'Not Valid' }];
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('accepts a lowerBand action', () => {
    const bundle = validBundle();
    firstRule(bundle).then = [{ kind: 'lowerBand' }];
    expect(() => parseRulesBundle(bundle)).not.toThrow();
  });

  it('rejects an action with an unknown kind', () => {
    const bundle = validBundle();
    firstRule(bundle).then = [{ kind: 'raiseBand' }];
    expect(() => parseRulesBundle(bundle)).toThrow(InvalidRulesBundleError);
  });

  it('collects every problem in one error', () => {
    try {
      parseRulesBundle({
        rulesVersion: '',
        confidenceFloor: 5,
        classFloors: {},
        bands: {},
        rules: 'nope',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidRulesBundleError);
      const problems = (error as InvalidRulesBundleError).details
        ?.problems as string[];
      expect(problems.length).toBeGreaterThan(1);
    }
  });
});
