import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AliasSource } from '../constants/ingredients.constants.js';
import { CatalogImportError } from '../errors/ingredients.errors.js';
import { normalizeAlias } from '../utils/normalize-alias.js';
import {
  buildCatalog,
  type CatalogRows,
  type IngredientOverlay,
  parseOverlay,
} from './catalog.builder.js';
import type { Taxonomy, TaxonomyClass } from './taxonomy.parser.js';
import { parseTaxonomy } from './taxonomy.parser.js';

const DATA_DIR = join(import.meta.dirname, '..', '..', '..', 'seeders', 'data');
const EMPTY_OVERLAY: IngredientOverlay = {
  displayNames: {},
  allergens: {},
  dietaryFlags: {},
};

function taxClass(
  id: number,
  name: string,
  aliases: Record<string, string[]> = {},
): TaxonomyClass {
  return { id, name, tier: 'A', group: 'vegetable', aliases };
}

function taxonomyOf(...classes: TaxonomyClass[]): Taxonomy {
  return { version: 'test', classes };
}

function errorOf(run: () => unknown): CatalogImportError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(CatalogImportError);
    return error as CatalogImportError;
  }
  throw new Error('expected a CatalogImportError');
}

describe('parseOverlay', () => {
  it('accepts the documented shape', () => {
    const value = {
      displayNames: { chili_small: "Bird's eye chili" },
      allergens: { egg: ['egg'] },
      dietaryFlags: { tofu: ['vegan'] },
    };
    expect(parseOverlay(value)).toEqual(value);
  });

  it('rejects a value that is not an object', () => {
    expect(errorOf(() => parseOverlay([])).details).toEqual({
      problems: ['the overlay must be an object'],
    });
  });

  it('collects every shape problem', () => {
    const error = errorOf(() =>
      parseOverlay({
        displayNames: { egg: '  ' },
        allergens: { egg: ['Egg'], tofu: 'soy' },
        extra: {},
      }),
    );
    expect(error.details).toEqual({
      problems: [
        'unknown key extra',
        'displayNames.egg must be a non-empty string',
        'allergens.egg must be a list of snake_case tags',
        'allergens.tofu must be a list of snake_case tags',
        'dietaryFlags must be a mapping',
      ],
    });
  });
});

describe('buildCatalog', () => {
  describe('with the vendored taxonomy and overlay', () => {
    const taxonomy = parseTaxonomy(
      readFileSync(join(DATA_DIR, 'taxonomy.yaml'), 'utf8'),
    );
    const overlay = parseOverlay(
      JSON.parse(
        readFileSync(join(DATA_DIR, 'ingredient-overlay.json'), 'utf8'),
      ),
    );
    const rows: CatalogRows = buildCatalog(taxonomy, overlay);
    const aliasFor = (
      alias: string,
    ): CatalogRows['aliases'][number] | undefined =>
      rows.aliases.find((a) => a.aliasNormalized === normalizeAlias(alias));

    it('builds one ingredient per class, in id order', () => {
      expect(rows.taxonomyVersion).toBe('2026.09.2');
      expect(rows.ingredients).toHaveLength(100);
      expect(rows.ingredients.map((i) => i.metadata.taxonomyClassId)).toEqual(
        Array.from({ length: 100 }, (_, id) => id),
      );
    });

    it('gives every class its model_class alias', () => {
      for (const ingredient of rows.ingredients) {
        expect(aliasFor(ingredient.slug)).toEqual({
          slug: ingredient.slug,
          alias: ingredient.slug,
          aliasNormalized: normalizeAlias(ingredient.slug),
          source: AliasSource.MODEL_CLASS,
          locale: null,
        });
      }
    });

    it('keeps normalised aliases unique', () => {
      const keys = rows.aliases.map((a) => a.aliasNormalized);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('maps regional names to their ingredient', () => {
      expect(aliasFor('kamatis')).toMatchObject({
        slug: 'tomato',
        source: AliasSource.REGIONAL,
      });
      expect(aliasFor('sibuyas bombay')).toMatchObject({
        slug: 'onion',
        source: AliasSource.REGIONAL,
        locale: 'tl',
      });
      expect(aliasFor('luy-a')).toMatchObject({
        slug: 'ginger',
        locale: 'ceb',
      });
    });

    it("normalises bird's eye chili into a synonym of chili_small", () => {
      expect(aliasFor("Bird's eye chili")).toEqual({
        slug: 'chili_small',
        alias: "Bird's eye chili",
        aliasNormalized: 'birds eye chili',
        source: AliasSource.SYNONYM,
        locale: 'en',
      });
    });

    it('applies display names, humanised names and allergens', () => {
      const bySlug = new Map(rows.ingredients.map((i) => [i.slug, i]));
      expect(bySlug.get('chicken_raw')?.canonicalName).toBe('Chicken');
      expect(bySlug.get('sweet_potato_leaves')).toEqual({
        slug: 'sweet_potato_leaves',
        canonicalName: 'Sweet potato leaves',
        category: 'leafy',
        metadata: { taxonomyClassId: 15, tier: 'A', allergens: [] },
        dietaryFlags: [],
      });
      expect(bySlug.get('shrimp')?.metadata.allergens).toEqual([
        'crustacean_shellfish',
      ]);
    });
  });

  it('orders aliases model_class, synonyms, then regional by sorted language', () => {
    const rows = buildCatalog(
      taxonomyOf(
        taxClass(0, 'bitter_gourd', {
          tl: ['ampalaya'],
          en: ['bitter melon'],
          ceb: ['paliya', 'ampalaya'],
        }),
      ),
      EMPTY_OVERLAY,
    );
    expect(rows.aliases.map((a) => [a.alias, a.source, a.locale])).toEqual([
      ['bitter_gourd', AliasSource.MODEL_CLASS, null],
      ['bitter melon', AliasSource.SYNONYM, 'en'],
      ['paliya', AliasSource.REGIONAL, 'ceb'],
      ['ampalaya', AliasSource.REGIONAL, 'ceb'],
    ]);
  });

  it('drops aliases that normalise to an empty string', () => {
    const rows = buildCatalog(
      taxonomyOf(taxClass(0, 'egg', { tl: ["'", 'itlog'] })),
      EMPTY_OVERLAY,
    );
    expect(rows.aliases.map((a) => a.aliasNormalized)).toEqual([
      'egg',
      'itlog',
    ]);
  });

  it('sorts and dedupes allergens and dietary flags', () => {
    const rows = buildCatalog(taxonomyOf(taxClass(0, 'tofu')), {
      displayNames: { tofu: 'Bean curd' },
      allergens: { tofu: ['soy', 'gluten', 'soy'] },
      dietaryFlags: { tofu: ['vegetarian', 'vegan'] },
    });
    expect(rows.ingredients[0]).toMatchObject({
      canonicalName: 'Bean curd',
      metadata: { allergens: ['gluten', 'soy'] },
      dietaryFlags: ['vegan', 'vegetarian'],
    });
  });

  it('rejects overlay keys that are not taxonomy classes', () => {
    const error = errorOf(() =>
      buildCatalog(taxonomyOf(taxClass(0, 'tomato')), {
        displayNames: { tomatoe: 'Tomato' },
        allergens: {},
        dietaryFlags: { tofu: ['vegan'] },
      }),
    );
    expect(error.details).toEqual({
      unknown: ['displayNames.tomatoe', 'dietaryFlags.tofu'],
    });
  });

  it('rejects two ingredients with the same canonical name', () => {
    const error = errorOf(() =>
      buildCatalog(taxonomyOf(taxClass(0, 'egg'), taxClass(1, 'chicken_egg')), {
        ...EMPTY_OVERLAY,
        displayNames: { chicken_egg: 'Egg' },
      }),
    );
    expect(error.details).toEqual({
      duplicates: [{ canonicalName: 'Egg', slugs: ['egg', 'chicken_egg'] }],
    });
  });

  it('rejects one normalised alias shared by different ingredients', () => {
    const error = errorOf(() =>
      buildCatalog(
        taxonomyOf(
          taxClass(0, 'chili_small', { tl: ['sili'] }),
          taxClass(1, 'chili_long', { tl: ['Silí'] }),
          taxClass(2, 'bell_pepper', { ceb: ['sili'] }),
        ),
        EMPTY_OVERLAY,
      ),
    );
    expect(error.message).toBe('alias collisions');
    expect(error.details).toEqual({
      collisions: [
        { alias: 'sili', slugs: ['chili_small', 'chili_long', 'bell_pepper'] },
      ],
    });
  });
});
