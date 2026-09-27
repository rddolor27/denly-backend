import type {
  CatalogIngredient,
  ConfidenceBand,
  IntelligenceDetection,
  StructuredIngredient,
} from '../models/structured-ingredient-data.model.js';

export interface MappedDetection {
  readonly detection: IntelligenceDetection;
  readonly ingredient: CatalogIngredient;
}

export interface DedupedIngredient {
  readonly ingredient: CatalogIngredient;
  readonly confidence: number;
  readonly detectionIds: readonly string[];
}

export type EnrichedIngredient = Omit<StructuredIngredient, 'confidenceBand'>;

export interface RuleDraft extends Omit<
  StructuredIngredient,
  'ruleHits' | 'confidenceBand'
> {
  ruleHits: string[];
  confidenceBand: ConfidenceBand;
}
