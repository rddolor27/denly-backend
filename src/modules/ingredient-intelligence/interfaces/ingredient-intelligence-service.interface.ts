import type {
  IntelligenceDetection,
  StructuredIngredientData,
} from '../models/structured-ingredient-data.model.js';

export interface IIngredientIntelligenceService {
  readonly rulesVersion: string;
  build(
    scanId: string,
    detections: readonly IntelligenceDetection[],
  ): Promise<StructuredIngredientData>;
}
