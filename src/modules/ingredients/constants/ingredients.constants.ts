import { Inject } from '@nestjs/common';

export const INGREDIENTS_SERVICE = Symbol('INGREDIENTS_SERVICE');
export const InjectIngredientsService = (): ParameterDecorator =>
  Inject(INGREDIENTS_SERVICE);

export enum AliasSource {
  MODEL_CLASS = 'model_class',
  SYNONYM = 'synonym',
  REGIONAL = 'regional',
  MANUAL = 'manual',
}

export const INGREDIENT_LIST_MAX_LIMIT = 100;
export const INGREDIENT_LIST_DEFAULT_LIMIT = 50;
