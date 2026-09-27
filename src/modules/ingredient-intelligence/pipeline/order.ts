import type {
  StructuredIngredient,
  UnknownDetection,
} from '../models/structured-ingredient-data.model.js';
import { compareStrings } from './compare-strings.js';

export interface OrderedResult {
  readonly ingredients: readonly StructuredIngredient[];
  readonly unknowns: readonly UnknownDetection[];
  readonly flags: readonly string[];
}

export function orderResults(
  ingredients: readonly StructuredIngredient[],
  unknowns: readonly UnknownDetection[],
  flags: readonly string[],
): OrderedResult {
  const orderedIngredients = [...ingredients].sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return compareStrings(a.canonicalName, b.canonicalName);
  });

  const orderedUnknowns = [...unknowns].sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return compareStrings(a.className, b.className);
  });

  const orderedFlags = [...flags].sort(compareStrings);

  return {
    ingredients: orderedIngredients,
    unknowns: orderedUnknowns,
    flags: orderedFlags,
  };
}
