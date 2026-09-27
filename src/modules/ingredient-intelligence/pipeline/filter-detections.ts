import type { RulesBundle } from '../models/rules-bundle.model.js';
import type { IntelligenceDetection } from '../models/structured-ingredient-data.model.js';

export interface FilterResult {
  readonly kept: readonly IntelligenceDetection[];
  readonly droppedCount: number;
}

export function filterDetections(
  detections: readonly IntelligenceDetection[],
  bundle: RulesBundle,
): FilterResult {
  const kept: IntelligenceDetection[] = [];
  let droppedCount = 0;

  for (const detection of detections) {
    const floor =
      bundle.classFloors[detection.className] ?? bundle.confidenceFloor;
    if (detection.confidence >= floor) {
      kept.push(detection);
    } else {
      droppedCount += 1;
    }
  }

  return { kept, droppedCount };
}
