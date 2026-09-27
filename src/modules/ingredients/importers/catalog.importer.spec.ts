import { type EntityManager, In, Not } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AliasSource } from '../constants/ingredients.constants.js';
import { IngredientAlias } from '../entities/ingredient-alias.entity.js';
import { Ingredient } from '../entities/ingredient.entity.js';
import { CatalogImportError } from '../errors/ingredients.errors.js';
import type { CatalogRows } from './catalog.builder.js';
import { importCatalog } from './catalog.importer.js';

const ROWS: CatalogRows = {
  taxonomyVersion: '2026.09.2',
  ingredients: [
    {
      slug: 'tomato',
      canonicalName: 'Tomato',
      category: 'vegetable',
      metadata: { taxonomyClassId: 1, tier: 'A', allergens: [] },
      dietaryFlags: [],
    },
  ],
  aliases: [
    {
      slug: 'tomato',
      alias: 'tomato',
      aliasNormalized: 'tomato',
      source: AliasSource.MODEL_CLASS,
      locale: null,
    },
    {
      slug: 'tomato',
      alias: 'kamatis',
      aliasNormalized: 'kamatis',
      source: AliasSource.REGIONAL,
      locale: 'ceb',
    },
  ],
};

describe('importCatalog', () => {
  const managerMockFactory = () => ({
    upsert: vi.fn(),
    find: vi.fn(),
    delete: vi.fn(),
  });
  let manager: ReturnType<typeof managerMockFactory>;

  beforeEach(() => {
    manager = managerMockFactory();
    manager.find.mockResolvedValue([{ id: 'uuid-tomato', slug: 'tomato' }]);
    manager.delete.mockResolvedValue({ affected: 3, raw: [] });
  });

  it('upserts ingredients by slug, prunes stale non-manual aliases and upserts the rest', async () => {
    const summary = await importCatalog(
      manager as unknown as EntityManager,
      ROWS,
    );

    expect(manager.upsert).toHaveBeenNthCalledWith(
      1,
      Ingredient,
      [
        {
          slug: 'tomato',
          canonicalName: 'Tomato',
          category: 'vegetable',
          metadata: { taxonomyClassId: 1, tier: 'A', allergens: [] },
          dietaryFlags: [],
        },
      ],
      { conflictPaths: ['slug'] },
    );
    expect(manager.find).toHaveBeenCalledWith(Ingredient, {
      select: { id: true, slug: true },
      where: { slug: In(['tomato']) },
    });
    expect(manager.delete).toHaveBeenCalledWith(IngredientAlias, {
      source: Not(AliasSource.MANUAL),
      aliasNormalized: Not(In(['tomato', 'kamatis'])),
    });
    expect(manager.upsert).toHaveBeenNthCalledWith(
      2,
      IngredientAlias,
      [
        {
          ingredientId: 'uuid-tomato',
          alias: 'tomato',
          aliasNormalized: 'tomato',
          source: AliasSource.MODEL_CLASS,
          locale: null,
        },
        {
          ingredientId: 'uuid-tomato',
          alias: 'kamatis',
          aliasNormalized: 'kamatis',
          source: AliasSource.REGIONAL,
          locale: 'ceb',
        },
      ],
      { conflictPaths: ['aliasNormalized'] },
    );
    expect(summary).toEqual({
      taxonomyVersion: '2026.09.2',
      ingredients: 1,
      aliases: 2,
      removedAliases: 3,
    });
  });

  it('fails before touching aliases when an ingredient id cannot be loaded', async () => {
    manager.find.mockResolvedValue([]);

    await expect(
      importCatalog(manager as unknown as EntityManager, ROWS),
    ).rejects.toBeInstanceOf(CatalogImportError);
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.upsert).toHaveBeenCalledTimes(1);
  });
});
