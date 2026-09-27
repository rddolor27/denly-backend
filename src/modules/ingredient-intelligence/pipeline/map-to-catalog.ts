import type {
  CatalogIngredient,
  IntelligenceDetection,
} from '../models/structured-ingredient-data.model.js';
import type { MappedDetection } from './pipeline-types.js';

export interface MapResult {
  readonly mapped: readonly MappedDetection[];
  readonly unmapped: readonly IntelligenceDetection[];
}

export function mapToCatalog(
  detections: readonly IntelligenceDetection[],
  catalog: ReadonlyMap<string, CatalogIngredient>,
): MapResult {
  const mapped: MappedDetection[] = [];
  const unmapped: IntelligenceDetection[] = [];

  for (const detection of detections) {
    const ingredient = catalog.get(detection.className);
    if (ingredient) {
      mapped.push({ detection, ingredient });
    } else {
      unmapped.push(detection);
    }
  }

  return { mapped, unmapped };
}
