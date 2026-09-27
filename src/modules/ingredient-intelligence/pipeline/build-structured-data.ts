import type { RulesBundle } from '../models/rules-bundle.model.js';
import type {
  CatalogIngredient,
  IntelligenceDetection,
  StructuredIngredientData,
} from '../models/structured-ingredient-data.model.js';
import { applyBands } from './band.js';
import { dedupe } from './dedupe.js';
import { enrichIngredients } from './enrich.js';
import { filterDetections } from './filter-detections.js';
import { mapToCatalog } from './map-to-catalog.js';
import { orderResults } from './order.js';
import { applyRules } from './rules.js';

export interface BuildStructuredDataInput {
  readonly scanId: string;
  readonly detections: readonly IntelligenceDetection[];
}

export function buildStructuredData(
  input: BuildStructuredDataInput,
  catalog: ReadonlyMap<string, CatalogIngredient>,
  bundle: RulesBundle,
): StructuredIngredientData {
  const { kept } = filterDetections(input.detections, bundle);
  const { mapped, unmapped } = mapToCatalog(kept, catalog);
  const { ingredients: deduped, unknowns } = dedupe(mapped, unmapped);
  const enriched = enrichIngredients(deduped);
  const banded = applyBands(enriched, bundle.bands);
  const { ingredients: withRules, flags } = applyRules(banded, bundle.rules);
  const ordered = orderResults(withRules, unknowns, flags);

  return {
    scanId: input.scanId,
    rulesVersion: bundle.rulesVersion,
    ingredients: ordered.ingredients,
    unknowns: ordered.unknowns,
    flags: ordered.flags,
  };
}
