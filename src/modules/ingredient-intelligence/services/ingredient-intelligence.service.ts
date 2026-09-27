import { Injectable, Logger, type Provider } from '@nestjs/common';
import { InjectIngredientsService } from '@/modules/ingredients/constants/ingredients.constants.js';
import type { IIngredientsService } from '@/modules/ingredients/interfaces/ingredients-service.interface.js';
import {
  INGREDIENT_INTELLIGENCE_SERVICE,
  InjectRulesBundle,
} from '../constants/ingredient-intelligence.constants.js';
import type { IIngredientIntelligenceService } from '../interfaces/ingredient-intelligence-service.interface.js';
import type { RulesBundle } from '../models/rules-bundle.model.js';
import type {
  CatalogIngredient,
  IntelligenceDetection,
  StructuredIngredientData,
} from '../models/structured-ingredient-data.model.js';
import { buildStructuredData } from '../pipeline/build-structured-data.js';

@Injectable()
export class IngredientIntelligenceService implements IIngredientIntelligenceService {
  private readonly logger = new Logger(IngredientIntelligenceService.name);

  constructor(
    @InjectRulesBundle() private readonly bundle: RulesBundle,
    @InjectIngredientsService()
    private readonly ingredients: IIngredientsService,
  ) {}

  get rulesVersion(): string {
    return this.bundle.rulesVersion;
  }

  async build(
    scanId: string,
    detections: readonly IntelligenceDetection[],
  ): Promise<StructuredIngredientData> {
    const classNames = [
      ...new Set(detections.map((detection) => detection.className)),
    ];
    const resolved = await this.ingredients.resolveModelClasses(classNames);

    const catalog = new Map<string, CatalogIngredient>();
    for (const [className, ingredient] of resolved) {
      catalog.set(className, {
        id: ingredient.id,
        slug: ingredient.slug,
        canonicalName: ingredient.canonicalName,
        category: ingredient.category,
        allergens: ingredient.metadata.allergens,
        dietaryFlags: ingredient.dietaryFlags,
      });
    }

    const result = buildStructuredData(
      { scanId, detections },
      catalog,
      this.bundle,
    );

    this.logger.debug(
      `[build] scan=${scanId} detections=${detections.length} classes=${classNames.length} resolved=${resolved.size} ingredients=${result.ingredients.length} unknowns=${result.unknowns.length}`,
    );

    return result;
  }
}

export const IngredientIntelligenceProvider: Provider = {
  provide: INGREDIENT_INTELLIGENCE_SERVICE,
  useClass: IngredientIntelligenceService,
};
