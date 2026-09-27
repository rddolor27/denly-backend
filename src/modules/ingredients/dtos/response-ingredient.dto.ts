import { ApiProperty } from '@nestjs/swagger';
import { AliasSource } from '../constants/ingredients.constants.js';
import type { IngredientPage } from '../interfaces/ingredients-service.interface.js';
import type { TaxonomyTier } from '../models/ingredient-metadata.js';
import type {
  IngredientAliasModel,
  IngredientModel,
} from '../models/ingredient.model.js';

export class ResponseIngredientAliasDTO {
  @ApiProperty({ example: 'kamatis' })
  alias!: string;

  @ApiProperty({ enum: AliasSource, enumName: 'AliasSource' })
  source!: AliasSource;

  @ApiProperty({ type: String, nullable: true, example: 'tl' })
  locale!: string | null;

  static fromModel(model: IngredientAliasModel): ResponseIngredientAliasDTO {
    return Object.assign(new ResponseIngredientAliasDTO(), {
      alias: model.alias,
      source: model.source,
      locale: model.locale,
    });
  }
}

export class ResponseIngredientDTO {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'tomato' })
  slug!: string;

  @ApiProperty({ example: 'Tomato' })
  canonicalName!: string;

  @ApiProperty({ example: 'vegetable' })
  category!: string;

  @ApiProperty({ enum: ['A', 'B'] })
  tier!: TaxonomyTier;

  @ApiProperty({ type: [String], example: ['fish'] })
  allergens!: string[];

  @ApiProperty({ type: [String], example: [] })
  dietaryFlags!: string[];

  static fromModel(model: IngredientModel): ResponseIngredientDTO {
    return Object.assign(new ResponseIngredientDTO(), {
      id: model.id,
      slug: model.slug,
      canonicalName: model.canonicalName,
      category: model.category,
      tier: model.metadata.tier,
      allergens: [...model.metadata.allergens],
      dietaryFlags: [...model.dietaryFlags],
    });
  }
}

export class ResponseIngredientDetailDTO extends ResponseIngredientDTO {
  @ApiProperty({ type: [ResponseIngredientAliasDTO] })
  aliases!: ResponseIngredientAliasDTO[];

  static override fromModel(
    model: IngredientModel,
  ): ResponseIngredientDetailDTO {
    return Object.assign(new ResponseIngredientDetailDTO(), {
      ...ResponseIngredientDTO.fromModel(model),
      aliases: model.aliases.map((alias) =>
        ResponseIngredientAliasDTO.fromModel(alias),
      ),
    });
  }
}

export class ResponseIngredientPageDTO {
  @ApiProperty({ type: [ResponseIngredientDTO] })
  items!: ResponseIngredientDTO[];

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  static fromModel(
    page: IngredientPage,
    limit: number,
    offset: number,
  ): ResponseIngredientPageDTO {
    return Object.assign(new ResponseIngredientPageDTO(), {
      items: page.items.map((item) => ResponseIngredientDTO.fromModel(item)),
      total: page.total,
      limit,
      offset,
    });
  }
}
