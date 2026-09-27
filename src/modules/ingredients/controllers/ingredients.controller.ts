import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '@/commons/auth/public.decorator.js';
import { ErrorResponseDto } from '@/commons/dtos/error-response.dto.js';
import { InjectIngredientsService } from '../constants/ingredients.constants.js';
import { IngredientSlugParamDTO } from '../dtos/ingredient-slug-param.dto.js';
import { ListIngredientsQueryDTO } from '../dtos/list-ingredients-query.dto.js';
import {
  ResponseIngredientDetailDTO,
  ResponseIngredientPageDTO,
} from '../dtos/response-ingredient.dto.js';
import type { IIngredientsService } from '../interfaces/ingredients-service.interface.js';

@Public()
@ApiTags('Ingredients')
@Controller('ingredients')
export class IngredientsController {
  constructor(
    @InjectIngredientsService()
    private readonly ingredientsService: IIngredientsService,
  ) {}

  @Get()
  @ApiOkResponse({ type: ResponseIngredientPageDTO })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async list(
    @Query() query: ListIngredientsQueryDTO,
  ): Promise<ResponseIngredientPageDTO> {
    const page = await this.ingredientsService.list(query.toQuery());
    return ResponseIngredientPageDTO.fromModel(page, query.limit, query.offset);
  }

  @Get(':slug')
  @ApiOkResponse({ type: ResponseIngredientDetailDTO })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async findBySlug(
    @Param() params: IngredientSlugParamDTO,
  ): Promise<ResponseIngredientDetailDTO> {
    return ResponseIngredientDetailDTO.fromModel(
      await this.ingredientsService.findBySlug(params.slug),
    );
  }
}
