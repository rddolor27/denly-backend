import type { AliasSource } from '../constants/ingredients.constants.js';
import type { IngredientAlias } from '../entities/ingredient-alias.entity.js';
import type { Ingredient } from '../entities/ingredient.entity.js';
import type { IngredientMetadata } from './ingredient-metadata.js';

export class IngredientAliasModel {
  readonly alias!: string;
  readonly source!: AliasSource;
  readonly locale!: string | null;

  static fromEntity(entity: IngredientAlias): IngredientAliasModel {
    return Object.assign(new IngredientAliasModel(), {
      alias: entity.alias,
      source: entity.source,
      locale: entity.locale,
    });
  }
}

export class IngredientModel {
  readonly id!: string;
  readonly slug!: string;
  readonly canonicalName!: string;
  readonly category!: string;
  readonly metadata!: IngredientMetadata;
  readonly dietaryFlags!: readonly string[];
  // Empty unless the query loaded the aliases relation.
  readonly aliases!: readonly IngredientAliasModel[];

  static fromEntity(entity: Ingredient): IngredientModel {
    return Object.assign(new IngredientModel(), {
      id: entity.id,
      slug: entity.slug,
      canonicalName: entity.canonicalName,
      category: entity.category,
      metadata: entity.metadata,
      dietaryFlags: entity.dietaryFlags,
      aliases: (entity.aliases ?? []).map((alias) =>
        IngredientAliasModel.fromEntity(alias),
      ),
    });
  }
}
