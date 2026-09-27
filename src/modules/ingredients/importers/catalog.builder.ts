import { AliasSource } from '../constants/ingredients.constants.js';
import { CatalogImportError } from '../errors/ingredients.errors.js';
import type { IngredientMetadata } from '../models/ingredient-metadata.js';
import { normalizeAlias } from '../utils/normalize-alias.js';
import type { Taxonomy, TaxonomyClass } from './taxonomy.parser.js';

export interface IngredientOverlay {
  readonly displayNames: Readonly<Record<string, string>>;
  readonly allergens: Readonly<Record<string, readonly string[]>>;
  readonly dietaryFlags: Readonly<Record<string, readonly string[]>>;
}

export interface IngredientRow {
  readonly slug: string;
  readonly canonicalName: string;
  readonly category: string;
  readonly metadata: IngredientMetadata;
  readonly dietaryFlags: readonly string[];
}

export interface AliasRow {
  readonly slug: string;
  readonly alias: string;
  readonly aliasNormalized: string;
  readonly source: AliasSource;
  readonly locale: string | null;
}

export interface CatalogRows {
  readonly taxonomyVersion: string;
  readonly ingredients: readonly IngredientRow[];
  readonly aliases: readonly AliasRow[];
}

const TAG = /^[a-z][a-z0-9_]*$/;
const OVERLAY_KEYS = ['displayNames', 'allergens', 'dietaryFlags'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTagList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((tag) => typeof tag === 'string' && TAG.test(tag))
  );
}

function parseTagMap(
  value: unknown,
  key: string,
  problems: string[],
): Record<string, readonly string[]> {
  const tags: Record<string, readonly string[]> = {};
  if (!isRecord(value)) {
    problems.push(`${key} must be a mapping`);
    return tags;
  }
  for (const [slug, list] of Object.entries(value)) {
    if (isTagList(list)) {
      tags[slug] = list;
    } else {
      problems.push(`${key}.${slug} must be a list of snake_case tags`);
    }
  }
  return tags;
}

function parseDisplayNames(
  value: unknown,
  problems: string[],
): Record<string, string> {
  const names: Record<string, string> = {};
  if (!isRecord(value)) {
    problems.push('displayNames must be a mapping');
    return names;
  }
  for (const [slug, name] of Object.entries(value)) {
    if (typeof name === 'string' && name.trim() !== '') {
      names[slug] = name;
    } else {
      problems.push(`displayNames.${slug} must be a non-empty string`);
    }
  }
  return names;
}

export function parseOverlay(value: unknown): IngredientOverlay {
  if (!isRecord(value)) {
    throw new CatalogImportError('invalid ingredient overlay', {
      problems: ['the overlay must be an object'],
    });
  }
  const problems: string[] = Object.keys(value)
    .filter((key) => !(OVERLAY_KEYS as readonly string[]).includes(key))
    .map((key) => `unknown key ${key}`);
  const overlay: IngredientOverlay = {
    displayNames: parseDisplayNames(value['displayNames'], problems),
    allergens: parseTagMap(value['allergens'], 'allergens', problems),
    dietaryFlags: parseTagMap(value['dietaryFlags'], 'dietaryFlags', problems),
  };
  if (problems.length > 0) {
    throw new CatalogImportError('invalid ingredient overlay', { problems });
  }
  return overlay;
}

function humanize(name: string): string {
  const spaced = name.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function sortedUnique(values: readonly string[] | undefined): string[] {
  return [...new Set(values ?? [])].toSorted();
}

function assertOverlayMatchesTaxonomy(
  taxonomy: Taxonomy,
  overlay: IngredientOverlay,
): void {
  const names = new Set(taxonomy.classes.map((c) => c.name));
  const unknown = OVERLAY_KEYS.flatMap((key) =>
    Object.keys(overlay[key])
      .filter((slug) => !names.has(slug))
      .map((slug) => `${key}.${slug}`),
  );
  if (unknown.length > 0) {
    throw new CatalogImportError(
      'overlay references ingredients missing from the taxonomy',
      { unknown },
    );
  }
}

function toIngredientRow(
  taxClass: TaxonomyClass,
  overlay: IngredientOverlay,
): IngredientRow {
  return {
    slug: taxClass.name,
    canonicalName:
      overlay.displayNames[taxClass.name] ?? humanize(taxClass.name),
    category: taxClass.group,
    metadata: {
      taxonomyClassId: taxClass.id,
      tier: taxClass.tier,
      allergens: sortedUnique(overlay.allergens[taxClass.name]),
    },
    dietaryFlags: sortedUnique(overlay.dietaryFlags[taxClass.name]),
  };
}

// Order encodes precedence when two aliases normalise alike: model_class > synonym > regional.
function candidateAliases(
  taxClass: TaxonomyClass,
  canonicalName: string,
): Omit<AliasRow, 'aliasNormalized'>[] {
  const slug = taxClass.name;
  const regionalLanguages = Object.keys(taxClass.aliases)
    .filter((language) => language !== 'en')
    .toSorted();
  return [
    { slug, alias: slug, source: AliasSource.MODEL_CLASS, locale: null },
    ...[canonicalName, ...(taxClass.aliases['en'] ?? [])].map((alias) => ({
      slug,
      alias,
      source: AliasSource.SYNONYM,
      locale: 'en',
    })),
    ...regionalLanguages.flatMap((language) =>
      (taxClass.aliases[language] ?? []).map((alias) => ({
        slug,
        alias,
        source: AliasSource.REGIONAL,
        locale: language,
      })),
    ),
  ];
}

export function buildCatalog(
  taxonomy: Taxonomy,
  overlay: IngredientOverlay,
): CatalogRows {
  assertOverlayMatchesTaxonomy(taxonomy, overlay);
  const entries = taxonomy.classes
    .toSorted((a, b) => a.id - b.id)
    .map((taxClass) => ({ taxClass, row: toIngredientRow(taxClass, overlay) }));
  const ingredients = entries.map(({ row }) => row);

  const slugsByName = new Map<string, string[]>();
  for (const row of ingredients) {
    slugsByName.set(row.canonicalName, [
      ...(slugsByName.get(row.canonicalName) ?? []),
      row.slug,
    ]);
  }
  const duplicateNames = [...slugsByName]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([canonicalName, slugs]) => ({ canonicalName, slugs }));
  if (duplicateNames.length > 0) {
    throw new CatalogImportError('duplicate canonical names', {
      duplicates: duplicateNames,
    });
  }

  const byNormalized = new Map<string, AliasRow>();
  const collisions = new Map<string, Set<string>>();
  for (const { taxClass, row } of entries) {
    for (const candidate of candidateAliases(taxClass, row.canonicalName)) {
      const aliasNormalized = normalizeAlias(candidate.alias);
      if (aliasNormalized === '') continue;
      const existing = byNormalized.get(aliasNormalized);
      if (existing === undefined) {
        byNormalized.set(aliasNormalized, { ...candidate, aliasNormalized });
      } else if (existing.slug !== candidate.slug) {
        const slugs =
          collisions.get(aliasNormalized) ?? new Set([existing.slug]);
        collisions.set(aliasNormalized, slugs.add(candidate.slug));
      }
    }
  }
  if (collisions.size > 0) {
    throw new CatalogImportError('alias collisions', {
      collisions: [...collisions].map(([alias, slugs]) => ({
        alias,
        slugs: [...slugs],
      })),
    });
  }

  return {
    taxonomyVersion: taxonomy.version,
    ingredients,
    aliases: [...byNormalized.values()],
  };
}
