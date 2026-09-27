import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

const SLUG_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export class IngredientSlugParamDTO {
  @ApiProperty({ pattern: SLUG_PATTERN.source, example: 'sweet_potato' })
  @IsString()
  @Matches(SLUG_PATTERN)
  slug!: string;
}
