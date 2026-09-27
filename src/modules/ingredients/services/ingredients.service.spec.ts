import { In, type Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AliasSource } from '../constants/ingredients.constants.js';
import type { IngredientAlias } from '../entities/ingredient-alias.entity.js';
import type { Ingredient } from '../entities/ingredient.entity.js';
import { IngredientNotFoundError } from '../errors/ingredients.errors.js';
import { IngredientsService } from './ingredients.service.js';

function ingredient(
  slug: string,
  aliases: Partial<IngredientAlias>[] = [],
): Ingredient {
  return {
    id: `id-${slug}`,
    slug,
    canonicalName: slug,
    category: 'vegetable',
    metadata: { taxonomyClassId: 0, tier: 'A', allergens: [] },
    dietaryFlags: [],
    aliases: aliases as IngredientAlias[],
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function alias(
  value: string,
  source: AliasSource,
  locale: string | null,
): Partial<IngredientAlias> {
  return { alias: value, source, locale };
}

describe('IngredientsService', () => {
  const queryBuilderMockFactory = () => {
    const qb = {
      andWhere: vi.fn(),
      orderBy: vi.fn(),
      addOrderBy: vi.fn(),
      skip: vi.fn(),
      take: vi.fn(),
      getManyAndCount: vi.fn(),
    };
    for (const method of [
      'andWhere',
      'orderBy',
      'addOrderBy',
      'skip',
      'take',
    ] as const) {
      qb[method].mockReturnValue(qb);
    }
    return qb;
  };
  let qb: ReturnType<typeof queryBuilderMockFactory>;
  let ingredientsRepository: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };
  let aliasesRepository: { find: ReturnType<typeof vi.fn> };
  let service: IngredientsService;

  beforeEach(() => {
    qb = queryBuilderMockFactory();
    ingredientsRepository = {
      createQueryBuilder: vi.fn().mockReturnValue(qb),
      findOne: vi.fn(),
    };
    aliasesRepository = { find: vi.fn() };
    service = new IngredientsService(
      ingredientsRepository as unknown as Repository<Ingredient>,
      aliasesRepository as unknown as Repository<IngredientAlias>,
    );
  });

  describe('list', () => {
    it('pages ingredients ordered by canonical name without filters', async () => {
      qb.getManyAndCount.mockResolvedValue([[ingredient('tomato')], 7]);

      const page = await service.list({
        q: null,
        category: null,
        limit: 1,
        offset: 5,
      });

      expect(ingredientsRepository.createQueryBuilder).toHaveBeenCalledWith(
        'ingredient',
      );
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.orderBy).toHaveBeenCalledWith(
        'ingredient.canonicalName',
        'ASC',
      );
      expect(qb.addOrderBy).toHaveBeenCalledWith('ingredient.id', 'ASC');
      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(qb.take).toHaveBeenCalledWith(1);
      expect(page.total).toBe(7);
      expect(page.items.map((i) => i.slug)).toEqual(['tomato']);
    });

    it('matches the normalised query as an alias prefix', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list({
        q: '  Kamatís ',
        category: null,
        limit: 50,
        offset: 0,
      });

      expect(qb.andWhere).toHaveBeenCalledTimes(1);
      const [condition, parameters] = qb.andWhere.mock.calls[0] as [
        string,
        unknown,
      ];
      expect(condition).toContain('a.alias_normalized LIKE :prefix');
      expect(parameters).toEqual({ prefix: 'kamatis%' });
    });

    it('skips the alias filter when the query normalises to nothing', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list({ q: " '%_ ", category: null, limit: 50, offset: 0 });

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('filters by category', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.list({ q: null, category: 'leafy', limit: 50, offset: 0 });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'ingredient.category = :category',
        {
          category: 'leafy',
        },
      );
    });
  });

  describe('findBySlug', () => {
    it('returns the ingredient with aliases sorted by source, locale, then alias', async () => {
      ingredientsRepository.findOne.mockResolvedValue(
        ingredient('tomato', [
          alias('tamatar', AliasSource.MANUAL, null),
          alias('kamatis', AliasSource.REGIONAL, 'tl'),
          alias('tomatoes', AliasSource.SYNONYM, 'en'),
          alias('kamatis', AliasSource.REGIONAL, 'ceb'),
          alias('Tomato', AliasSource.SYNONYM, 'en'),
          alias('tomato', AliasSource.MODEL_CLASS, null),
        ]),
      );

      const model = await service.findBySlug('tomato');

      expect(ingredientsRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'tomato' },
        relations: { aliases: true },
      });
      expect(model.aliases).toEqual([
        { alias: 'tomato', source: AliasSource.MODEL_CLASS, locale: null },
        { alias: 'Tomato', source: AliasSource.SYNONYM, locale: 'en' },
        { alias: 'tomatoes', source: AliasSource.SYNONYM, locale: 'en' },
        { alias: 'kamatis', source: AliasSource.REGIONAL, locale: 'ceb' },
        { alias: 'kamatis', source: AliasSource.REGIONAL, locale: 'tl' },
        { alias: 'tamatar', source: AliasSource.MANUAL, locale: null },
      ]);
    });

    it('throws IngredientNotFoundError for an unknown slug', async () => {
      ingredientsRepository.findOne.mockResolvedValue(null);

      await expect(service.findBySlug('dragonfruit')).rejects.toBeInstanceOf(
        IngredientNotFoundError,
      );
    });
  });

  describe('resolveModelClasses', () => {
    it('returns an empty map without querying for no class names', async () => {
      const resolved = await service.resolveModelClasses([]);

      expect(resolved.size).toBe(0);
      expect(aliasesRepository.find).not.toHaveBeenCalled();
    });

    it('resolves unique class names in one query through model_class aliases', async () => {
      aliasesRepository.find.mockResolvedValue([
        {
          aliasNormalized: 'sweet potato',
          ingredient: ingredient('sweet_potato'),
        },
        { aliasNormalized: 'egg', ingredient: ingredient('egg') },
      ]);

      const resolved = await service.resolveModelClasses([
        'sweet_potato',
        'egg',
        'sweet_potato',
        'dragonfruit',
      ]);

      expect(aliasesRepository.find).toHaveBeenCalledTimes(1);
      expect(aliasesRepository.find).toHaveBeenCalledWith({
        where: {
          aliasNormalized: In(['sweet potato', 'egg', 'dragonfruit']),
          source: AliasSource.MODEL_CLASS,
        },
        relations: { ingredient: true },
      });
      expect([...resolved.keys()]).toEqual(['sweet_potato', 'egg']);
      expect(resolved.get('sweet_potato')?.slug).toBe('sweet_potato');
      expect(resolved.has('dragonfruit')).toBe(false);
    });
  });
});
