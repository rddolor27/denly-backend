export type ConfidenceBand = 'high' | 'medium' | 'low';

export interface StructuredIngredientMetadata {
  readonly allergens: readonly string[];
}

export interface StructuredIngredient {
  readonly ingredientId: string;
  readonly slug: string;
  readonly canonicalName: string;
  readonly category: string;
  readonly confidence: number;
  readonly confidenceBand: ConfidenceBand;
  readonly detectionIds: readonly string[];
  readonly metadata: StructuredIngredientMetadata;
  readonly dietaryFlags: readonly string[];
  readonly ruleHits: readonly string[];
}

export interface UnknownDetection {
  readonly className: string;
  readonly confidence: number;
  readonly detectionIds: readonly string[];
}

// The contract shared with the app's offline evaluator (ADR 0003): same shape, same order.
export interface StructuredIngredientData {
  readonly scanId: string;
  readonly rulesVersion: string;
  readonly ingredients: readonly StructuredIngredient[];
  readonly unknowns: readonly UnknownDetection[];
  readonly flags: readonly string[];
}

export interface IntelligenceDetection {
  readonly id: string;
  readonly className: string;
  readonly confidence: number;
}

export interface CatalogIngredient {
  readonly id: string;
  readonly slug: string;
  readonly canonicalName: string;
  readonly category: string;
  readonly allergens: readonly string[];
  readonly dietaryFlags: readonly string[];
}
