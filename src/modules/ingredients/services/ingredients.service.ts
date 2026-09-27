import { Injectable, type Provider } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AliasSource,
  INGREDIENTS_SERVICE,
} from '../constants/ingredients.constants.js';
import { IngredientAlias } from '../entities/ingredient-alias.entity.js';
import { Ingredient } from '../entities/ingredient.entity.js';
import { IngredientNotFoundError } from '../errors/ingredients.errors.js';
import type {
  IIngredientsService,
  IngredientListQuery,
  IngredientPage,
} from '../interfaces/ingredients-service.interface.js';
import { IngredientModel } from '../models/ingredient.model.js';
import { normalizeAlias } from '../utils/normalize-alias.js';

const SOURCE_ORDER: readonly AliasSource[] = [
  AliasSource.MODEL_CLASS,
  AliasSource.SYNONYM,
  AliasSource.REGIONAL,
  AliasSource.MANUAL,
];

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareAliases(a: IngredientAlias, b: IngredientAlias): number {
  return (
    SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source) ||
    compareText(a.locale ?? '', b.locale ?? '') ||
    compareText(a.alias, b.alias)
  );
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class IngredientsService implements IIngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientsRepository: Repository<Ingredient>,
    @InjectRepository(IngredientAlias)
    private readonly aliasesRepository: Repository<IngredientAlias>,
  ) {}

  async list(query: IngredientListQuery): Promise<IngredientPage> {
    const qb = this.ingredientsRepository.createQueryBuilder('ingredient');
    const prefix = query.q === null ? '' : normalizeAlias(query.q);
    if (prefix !== '') {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM ingredient_alias a WHERE a.ingredient_id = ingredient.id AND a.alias_normalized LIKE :prefix ESCAPE '\\')`,
        { prefix: `${escapeLike(prefix)}%` },
      );
    }
    if (query.category !== null) {
      qb.andWhere('ingredient.category = :category', {
        category: query.category,
      });
    }
    const [entities, total] = await qb
      .orderBy('ingredient.canonicalName', 'ASC')
      .addOrderBy('ingredient.id', 'ASC')
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();
    return {
      items: entities.map((entity) => IngredientModel.fromEntity(entity)),
      total,
    };
  }

  async findBySlug(slug: string): Promise<IngredientModel> {
    const entity = await this.ingredientsRepository.findOne({
      where: { slug },
      relations: { aliases: true },
    });
    if (!entity) throw new IngredientNotFoundError(slug);
    entity.aliases.sort(compareAliases);
    return IngredientModel.fromEntity(entity);
  }

  async resolveModelClasses(
    classNames: readonly string[],
  ): Promise<ReadonlyMap<string, IngredientModel>> {
    const keyByName = new Map(
      [...new Set(classNames)].map((name) => [name, normalizeAlias(name)]),
    );
    if (keyByName.size === 0) return new Map();

    const aliases = await this.aliasesRepository.find({
      where: {
        aliasNormalized: In([...new Set(keyByName.values())]),
        source: AliasSource.MODEL_CLASS,
      },
      relations: { ingredient: true },
    });
    const ingredientByKey = new Map(
      aliases.map((alias) => [
        alias.aliasNormalized,
        IngredientModel.fromEntity(alias.ingredient),
      ]),
    );

    const resolved = new Map<string, IngredientModel>();
    for (const [name, key] of keyByName) {
      const ingredient = ingredientByKey.get(key);
      if (ingredient) resolved.set(name, ingredient);
    }
    return resolved;
  }
}

export const IngredientsProvider: Provider = {
  provide: INGREDIENTS_SERVICE,
  useClass: IngredientsService,
};
