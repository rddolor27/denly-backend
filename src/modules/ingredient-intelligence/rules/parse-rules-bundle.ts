import { CLASS_NAME_PATTERN } from '@/modules/model-registry/constants/model-registry.constants.js';
import { InvalidRulesBundleError } from '../errors/ingredient-intelligence.errors.js';
import type { RulesBundle } from '../models/rules-bundle.model.js';

const RULE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FLAG_PATTERN = /^[a-z][a-z0-9_]*$/;
const PREDICATE_KINDS = new Set([
  'anySlug',
  'allSlugs',
  'anyCategory',
  'anyAllergen',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnitInterval(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNonEmptyStringArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string')
  );
}

function checkRulesVersion(value: unknown, problems: string[]): void {
  if (!isNonEmptyString(value)) {
    problems.push('rulesVersion must be a non-empty string');
  }
}

function checkConfidenceFloor(value: unknown, problems: string[]): void {
  if (!isUnitInterval(value)) {
    problems.push('confidenceFloor must be a number in [0, 1]');
  }
}

function checkClassFloors(value: unknown, problems: string[]): void {
  if (!isRecord(value)) {
    problems.push('classFloors must be an object');
    return;
  }
  for (const [key, floor] of Object.entries(value)) {
    if (!CLASS_NAME_PATTERN.test(key)) {
      problems.push(
        `classFloors key "${key}" does not match the class name pattern`,
      );
    }
    if (!isUnitInterval(floor)) {
      problems.push(`classFloors["${key}"] must be a number in [0, 1]`);
    }
  }
}

function checkBands(
  value: unknown,
  confidenceFloor: unknown,
  problems: string[],
): void {
  if (!isRecord(value)) {
    problems.push('bands must be an object');
    return;
  }
  const { high, medium } = value;
  if (!isUnitInterval(high)) {
    problems.push('bands.high must be a number in [0, 1]');
  }
  if (!isUnitInterval(medium)) {
    problems.push('bands.medium must be a number in [0, 1]');
  }
  if (
    typeof confidenceFloor === 'number' &&
    typeof medium === 'number' &&
    typeof high === 'number' &&
    !(confidenceFloor <= medium && medium <= high)
  ) {
    problems.push(
      'bands must satisfy confidenceFloor <= bands.medium <= bands.high',
    );
  }
}

function checkPredicate(
  value: unknown,
  path: string,
  problems: string[],
): void {
  if (!isRecord(value)) {
    problems.push(`${path} must be an object`);
    return;
  }
  const { kind, values } = value;
  if (typeof kind !== 'string' || !PREDICATE_KINDS.has(kind)) {
    problems.push(
      `${path}.kind must be one of anySlug, allSlugs, anyCategory, anyAllergen`,
    );
  }
  if (!isNonEmptyStringArray(values)) {
    problems.push(`${path}.values must be a non-empty string array`);
  }
}

function checkAction(value: unknown, path: string, problems: string[]): void {
  if (!isRecord(value)) {
    problems.push(`${path} must be an object`);
    return;
  }
  if (value.kind === 'addFlag') {
    if (!isNonEmptyString(value.flag) || !FLAG_PATTERN.test(value.flag)) {
      problems.push(`${path}.flag must match ${FLAG_PATTERN.source}`);
    }
    return;
  }
  if (value.kind === 'lowerBand') {
    return;
  }
  problems.push(`${path}.kind must be addFlag or lowerBand`);
}

function checkRule(
  value: unknown,
  index: number,
  seenIds: Set<string>,
  problems: string[],
): void {
  const path = `rules[${index}]`;
  if (!isRecord(value)) {
    problems.push(`${path} must be an object`);
    return;
  }
  const { id, reason, when, then } = value;

  if (!isNonEmptyString(id) || !RULE_ID_PATTERN.test(id)) {
    problems.push(`${path}.id must match ${RULE_ID_PATTERN.source}`);
  } else if (seenIds.has(id)) {
    problems.push(`${path}.id "${id}" is duplicated`);
  } else {
    seenIds.add(id);
  }

  if (!isNonEmptyString(reason)) {
    problems.push(`${path}.reason must be a non-empty string`);
  }

  checkPredicate(when, `${path}.when`, problems);

  if (!Array.isArray(then) || then.length === 0) {
    problems.push(`${path}.then must be a non-empty array`);
  } else {
    then.forEach((action, actionIndex) =>
      checkAction(action, `${path}.then[${actionIndex}]`, problems),
    );
  }
}

function checkRules(value: unknown, problems: string[]): void {
  if (!Array.isArray(value)) {
    problems.push('rules must be an array');
    return;
  }
  const seenIds = new Set<string>();
  value.forEach((rule, index) => checkRule(rule, index, seenIds, problems));
}

export function parseRulesBundle(value: unknown): RulesBundle {
  const problems: string[] = [];

  if (!isRecord(value)) {
    throw new InvalidRulesBundleError(['bundle must be an object']);
  }

  checkRulesVersion(value.rulesVersion, problems);
  checkConfidenceFloor(value.confidenceFloor, problems);
  checkClassFloors(value.classFloors, problems);
  checkBands(value.bands, value.confidenceFloor, problems);
  checkRules(value.rules, problems);

  if (problems.length > 0) {
    throw new InvalidRulesBundleError(problems);
  }

  // Every field was checked above against the exact RulesBundle shape.
  return value as unknown as RulesBundle;
}
