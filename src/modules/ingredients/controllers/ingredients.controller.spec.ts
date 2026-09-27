import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AliasSource } from '../constants/ingredients.constants.js';
import { IngredientSlugParamDTO } from '../dtos/ingredient-slug-param.dto.js';
import { ListIngredientsQueryDTO } from '../dtos/list-ingredients-query.dto.js';
import { IngredientNotFoundError } from '../errors/ingredients.errors.js';
import {
  IngredientAliasModel,
  IngredientModel,
} from '../models/ingredient.model.js';
import { IngredientsController } from './ingredients.controller.js';

const MILKFISH = Object.assign(new IngredientModel(), {
  id: 'uuid-milkfish',
  slug: 'milkfish',
  canonicalName: 'Milkfish',
  category: 'fish',
  metadata: { taxonomyClassId: 54, tier: 'A', allergens: ['fish'] },
  dietaryFlags: [],
  aliases: [
    Object.assign(new IngredientAliasModel(), {
      alias: 'bangus',
      source: AliasSource.REGIONAL,
      locale: 'tl',
    }),
  ],
});

describe('IngredientsController', () => {
  const serviceMockFactory = () => ({
    list: vi.fn(),
    findBySlug: vi.fn(),
    resolveModelClasses: vi.fn(),
  });
  let serviceMock: ReturnType<typeof serviceMockFactory>;
  let controller: IngredientsController;

  beforeEach(() => {
    serviceMock = serviceMockFactory();
    controller = new IngredientsController(serviceMock);
  });

  it('passes the query to the service and maps the page', async () => {
    serviceMock.list.mockResolvedValue({ items: [MILKFISH], total: 1 });
    const query = Object.assign(new ListIngredientsQueryDTO(), { q: 'bang' });

    const result = await controller.list(query);

    expect(serviceMock.list).toHaveBeenCalledWith({
      q: 'bang',
      category: null,
      limit: 50,
      offset: 0,
    });
    expect(result).toEqual({
      items: [
        {
          id: 'uuid-milkfish',
          slug: 'milkfish',
          canonicalName: 'Milkfish',
          category: 'fish',
          tier: 'A',
          allergens: ['fish'],
          dietaryFlags: [],
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });
  });

  it('maps one ingredient with its aliases', async () => {
    serviceMock.findBySlug.mockResolvedValue(MILKFISH);
    const params = Object.assign(new IngredientSlugParamDTO(), {
      slug: 'milkfish',
    });

    const result = await controller.findBySlug(params);

    expect(serviceMock.findBySlug).toHaveBeenCalledWith('milkfish');
    expect(result).toMatchObject({
      slug: 'milkfish',
      tier: 'A',
      aliases: [
        { alias: 'bangus', source: AliasSource.REGIONAL, locale: 'tl' },
      ],
    });
  });

  it('propagates IngredientNotFoundError', async () => {
    serviceMock.findBySlug.mockRejectedValue(new IngredientNotFoundError('x'));

    await expect(
      controller.findBySlug(
        Object.assign(new IngredientSlugParamDTO(), { slug: 'x' }),
      ),
    ).rejects.toBeInstanceOf(IngredientNotFoundError);
  });
});
