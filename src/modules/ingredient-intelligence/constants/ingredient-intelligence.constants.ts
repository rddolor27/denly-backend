import { Inject } from '@nestjs/common';

export const INGREDIENT_INTELLIGENCE_SERVICE = Symbol(
  'INGREDIENT_INTELLIGENCE_SERVICE',
);
export const InjectIngredientIntelligenceService = (): ParameterDecorator =>
  Inject(INGREDIENT_INTELLIGENCE_SERVICE);

export const RULES_BUNDLE = Symbol('RULES_BUNDLE');
export const InjectRulesBundle = (): ParameterDecorator => Inject(RULES_BUNDLE);
