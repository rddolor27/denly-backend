import type {
  IntelligenceDetection,
  UnknownDetection,
} from '../models/structured-ingredient-data.model.js';
import { compareStrings } from './compare-strings.js';
import type { DedupedIngredient, MappedDetection } from './pipeline-types.js';

export interface DedupeResult {
  readonly ingredients: readonly DedupedIngredient[];
  readonly unknowns: readonly UnknownDetection[];
}

export function dedupe(
  mapped: readonly MappedDetection[],
  unmapped: readonly IntelligenceDetection[],
): DedupeResult {
  const byIngredientId = new Map<
    string,
    {
      readonly ingredient: MappedDetection['ingredient'];
      confidence: number;
      detectionIds: string[];
    }
  >();

  for (const { detection, ingredient } of mapped) {
    const existing = byIngredientId.get(ingredient.id);
    if (existing) {
      existing.confidence = Math.max(existing.confidence, detection.confidence);
      existing.detectionIds.push(detection.id);
    } else {
      byIngredientId.set(ingredient.id, {
        ingredient,
        confidence: detection.confidence,
        detectionIds: [detection.id],
      });
    }
  }

  const ingredients: DedupedIngredient[] = [...byIngredientId.values()].map(
    (entry) => ({
      ingredient: entry.ingredient,
      confidence: entry.confidence,
      detectionIds: [...entry.detectionIds].sort(compareStrings),
    }),
  );

  const byClassName = new Map<
    string,
    { confidence: number; detectionIds: string[] }
  >();

  for (const detection of unmapped) {
    const existing = byClassName.get(detection.className);
    if (existing) {
      existing.confidence = Math.max(existing.confidence, detection.confidence);
      existing.detectionIds.push(detection.id);
    } else {
      byClassName.set(detection.className, {
        confidence: detection.confidence,
        detectionIds: [detection.id],
      });
    }
  }

  const unknowns: UnknownDetection[] = [...byClassName.entries()].map(
    ([className, entry]) => ({
      className,
      confidence: entry.confidence,
      detectionIds: [...entry.detectionIds].sort(compareStrings),
    }),
  );

  return { ingredients, unknowns };
}
