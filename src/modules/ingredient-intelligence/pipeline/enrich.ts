import type {
  DedupedIngredient,
  EnrichedIngredient,
} from './pipeline-types.js';

export function enrichIngredients(
  deduped: readonly DedupedIngredient[],
): readonly EnrichedIngredient[] {
  return deduped.map((entry) => ({
    ingredientId: entry.ingredient.id,
    slug: entry.ingredient.slug,
    canonicalName: entry.ingredient.canonicalName,
    category: entry.ingredient.category,
    confidence: entry.confidence,
    detectionIds: entry.detectionIds,
    metadata: { allergens: entry.ingredient.allergens },
    dietaryFlags: entry.ingredient.dietaryFlags,
    ruleHits: [],
  }));
}
