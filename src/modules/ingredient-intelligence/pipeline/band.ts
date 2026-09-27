import type { ConfidenceBands } from '../models/rules-bundle.model.js';
import type {
  ConfidenceBand,
  StructuredIngredient,
} from '../models/structured-ingredient-data.model.js';
import type { EnrichedIngredient } from './pipeline-types.js';

export function bandFor(
  confidence: number,
  bands: ConfidenceBands,
): ConfidenceBand {
  if (confidence >= bands.high) {
    return 'high';
  }
  if (confidence >= bands.medium) {
    return 'medium';
  }
  return 'low';
}

export function applyBands(
  ingredients: readonly EnrichedIngredient[],
  bands: ConfidenceBands,
): readonly StructuredIngredient[] {
  return ingredients.map((ingredient) => ({
    ...ingredient,
    confidenceBand: bandFor(ingredient.confidence, bands),
  }));
}
