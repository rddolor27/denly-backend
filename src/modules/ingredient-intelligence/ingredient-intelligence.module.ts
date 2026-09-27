import { Module, type Provider } from '@nestjs/common';
import { IngredientsModule } from '@/modules/ingredients/ingredients.module.js';
import { RULES_BUNDLE } from './constants/ingredient-intelligence.constants.js';
import rulesBundleJson from './data/rules-bundle.json' with { type: 'json' };
import type { RulesBundle } from './models/rules-bundle.model.js';
import { parseRulesBundle } from './rules/parse-rules-bundle.js';
import { IngredientIntelligenceProvider } from './services/ingredient-intelligence.service.js';

const rulesBundleProvider: Provider = {
  provide: RULES_BUNDLE,
  useFactory: (): RulesBundle => parseRulesBundle(rulesBundleJson),
};

@Module({
  imports: [IngredientsModule],
  providers: [rulesBundleProvider, IngredientIntelligenceProvider],
  exports: [IngredientIntelligenceProvider],
})
export class IngredientIntelligenceModule {}
