import { type EntityManager, In, Not } from 'typeorm';
import { AliasSource } from '../constants/ingredients.constants.js';
import { IngredientAlias } from '../entities/ingredient-alias.entity.js';
import { Ingredient } from '../entities/ingredient.entity.js';
import { CatalogImportError } from '../errors/ingredients.errors.js';
import type { CatalogRows } from './catalog.builder.js';

export interface CatalogImportSummary {
  readonly taxonomyVersion: string;
  readonly ingredients: number;
  readonly aliases: number;
  readonly removedAliases: number;
}

// Ingredients are never deleted: stored scans reference them.
export async function importCatalog(
  manager: EntityManager,
  rows: CatalogRows,
): Promise<CatalogImportSummary> {
  await manager.upsert(
    Ingredient,
    rows.ingredients.map((row) => ({
      slug: row.slug,
      canonicalName: row.canonicalName,
      category: row.category,
      metadata: row.metadata,
      dietaryFlags: [...row.dietaryFlags],
    })),
    { conflictPaths: ['slug'] },
  );

  const slugs = rows.ingredients.map((row) => row.slug);
  const stored = await manager.find(Ingredient, {
    select: { id: true, slug: true },
    where: { slug: In(slugs) },
  });
  const idBySlug = new Map(
    stored.map((ingredient) => [ingredient.slug, ingredient.id]),
  );

  const aliases = rows.aliases.map((row) => {
    const ingredientId = idBySlug.get(row.slug);
    if (ingredientId === undefined) {
      throw new CatalogImportError(
        'alias for an ingredient that was not stored',
        {
          slug: row.slug,
        },
      );
    }
    return {
      ingredientId,
      alias: row.alias,
      aliasNormalized: row.aliasNormalized,
      source: row.source,
      locale: row.locale,
    };
  });

  const removed = await manager.delete(IngredientAlias, {
    source: Not(AliasSource.MANUAL),
    aliasNormalized: Not(In(aliases.map((a) => a.aliasNormalized))),
  });
  await manager.upsert(IngredientAlias, aliases, {
    conflictPaths: ['aliasNormalized'],
  });

  return {
    taxonomyVersion: rows.taxonomyVersion,
    ingredients: rows.ingredients.length,
    aliases: aliases.length,
    removedAliases: removed.affected ?? 0,
  };
}
