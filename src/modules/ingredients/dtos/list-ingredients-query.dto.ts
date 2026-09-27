import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  INGREDIENT_LIST_DEFAULT_LIMIT,
  INGREDIENT_LIST_MAX_LIMIT,
} from '../constants/ingredients.constants.js';
import type { IngredientListQuery } from '../interfaces/ingredients-service.interface.js';

const CATEGORY_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const MAX_OFFSET = 10_000;

export class ListIngredientsQueryDTO {
  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Prefix of any alias (English, Filipino, Bisaya, model class)',
    example: 'kamat',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    pattern: CATEGORY_PATTERN.source,
    example: 'vegetable',
  })
  @IsOptional()
  @IsString()
  @Matches(CATEGORY_PATTERN)
  category?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: INGREDIENT_LIST_MAX_LIMIT,
    default: INGREDIENT_LIST_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INGREDIENT_LIST_MAX_LIMIT)
  limit: number = INGREDIENT_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_OFFSET, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_OFFSET)
  offset: number = 0;

  toQuery(): IngredientListQuery {
    return {
      q: this.q ?? null,
      category: this.category ?? null,
      limit: this.limit,
      offset: this.offset,
    };
  }
}
