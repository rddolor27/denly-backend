import { parse } from 'yaml';
import { CatalogImportError } from '../errors/ingredients.errors.js';
import type { TaxonomyTier } from '../models/ingredient-metadata.js';

export interface TaxonomyClass {
  readonly id: number;
  readonly name: string;
  readonly tier: TaxonomyTier;
  readonly group: string;
  readonly aliases: Readonly<Record<string, readonly string[]>>;
}

export interface Taxonomy {
  readonly version: string;
  readonly classes: readonly TaxonomyClass[];
}

const CLASS_NAME = /^[a-z][a-z0-9_]*$/;
const LANGUAGE_CODE = /^[a-z]{2,3}$/;
const TIERS: readonly string[] = ['A', 'B'] satisfies TaxonomyTier[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isTier(value: unknown): value is TaxonomyTier {
  return typeof value === 'string' && TIERS.includes(value);
}

function parseAliases(
  value: unknown,
  where: string,
  problems: string[],
): Record<string, readonly string[]> {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) {
    problems.push(`${where}: aliases must be a mapping`);
    return {};
  }
  const aliases: Record<string, readonly string[]> = {};
  for (const [language, names] of Object.entries(value)) {
    if (!LANGUAGE_CODE.test(language)) {
      problems.push(
        `${where}: alias language ${JSON.stringify(language)} is not a 2-3 letter code`,
      );
      continue;
    }
    if (names === undefined || names === null) {
      aliases[language] = [];
    } else if (isStringList(names)) {
      aliases[language] = names;
    } else {
      problems.push(`${where}: aliases.${language} must be a list of strings`);
    }
  }
  return aliases;
}

function parseClass(
  item: unknown,
  position: number,
  seenNames: Set<string>,
  problems: string[],
): TaxonomyClass | null {
  const where = `classes[${position}]`;
  if (!isRecord(item)) {
    problems.push(`${where}: must be a mapping`);
    return null;
  }
  const before = problems.length;
  const { id, name, tier, group } = item;
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    problems.push(`${where}: id must be an integer`);
  } else if (id !== position) {
    problems.push(`${where}: ids must be contiguous from 0, got ${id}`);
  }
  if (typeof name !== 'string' || !CLASS_NAME.test(name)) {
    problems.push(`${where}: name must be lowercase snake_case`);
  } else if (seenNames.has(name)) {
    problems.push(`${where}: duplicate class name ${name}`);
  } else {
    seenNames.add(name);
  }
  if (!isTier(tier)) {
    problems.push(`${where}: tier must be A or B`);
  }
  if (!isNonEmptyString(group)) {
    problems.push(`${where}: group must be a non-empty string`);
  }
  const aliases = parseAliases(item['aliases'], where, problems);
  if (
    problems.length > before ||
    typeof id !== 'number' ||
    typeof name !== 'string' ||
    !isTier(tier) ||
    typeof group !== 'string'
  ) {
    return null;
  }
  return { id, name, tier, group, aliases };
}

export function parseTaxonomy(text: string): Taxonomy {
  let document: unknown;
  try {
    document = parse(text);
  } catch (error) {
    throw new CatalogImportError('taxonomy is not valid YAML', {
      problems: [(error as Error).message],
    });
  }
  if (!isRecord(document)) {
    throw new CatalogImportError('invalid taxonomy', {
      problems: ['the document must be a mapping'],
    });
  }

  const problems: string[] = [];
  const { version, classes: items } = document;
  if (!isNonEmptyString(version)) {
    problems.push('version must be a non-empty string');
  }
  if (!Array.isArray(items) || items.length === 0) {
    problems.push('classes must be a non-empty list');
  }

  const classes: TaxonomyClass[] = [];
  const seenNames = new Set<string>();
  for (const [position, item] of (Array.isArray(items)
    ? items
    : []
  ).entries()) {
    const parsed = parseClass(item, position, seenNames, problems);
    if (parsed !== null) classes.push(parsed);
  }

  if (problems.length > 0 || typeof version !== 'string') {
    throw new CatalogImportError('invalid taxonomy', { problems });
  }
  return { version, classes };
}
