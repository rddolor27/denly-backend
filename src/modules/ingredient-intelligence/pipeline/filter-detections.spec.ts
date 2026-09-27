import { describe, expect, it } from 'vitest';
import type { RulesBundle } from '../models/rules-bundle.model.js';
import type { IntelligenceDetection } from '../models/structured-ingredient-data.model.js';
import { filterDetections } from './filter-detections.js';

function bundle(overrides: Partial<RulesBundle> = {}): RulesBundle {
  return {
    rulesVersion: 'rules-test-1',
    confidenceFloor: 0.3,
    classFloors: { shrimp: 0.6 },
    bands: { high: 0.7, medium: 0.45 },
    rules: [],
    ...overrides,
  };
}

function detection(
  overrides: Partial<IntelligenceDetection> = {},
): IntelligenceDetection {
  return { id: 'd1', className: 'egg', confidence: 0.5, ...overrides };
}

describe('filterDetections', () => {
  it('keeps a detection at or above the global confidence floor', () => {
    const result = filterDetections([detection({ confidence: 0.3 })], bundle());
    expect(result.kept).toHaveLength(1);
    expect(result.droppedCount).toBe(0);
  });

  it('drops a detection below the global confidence floor', () => {
    const result = filterDetections(
      [detection({ confidence: 0.29 })],
      bundle(),
    );
    expect(result.kept).toHaveLength(0);
    expect(result.droppedCount).toBe(1);
  });

  it('uses a per-class floor over the global floor when one exists', () => {
    const kept = filterDetections(
      [detection({ className: 'shrimp', confidence: 0.6 })],
      bundle(),
    );
    expect(kept.kept).toHaveLength(1);

    const dropped = filterDetections(
      [detection({ className: 'shrimp', confidence: 0.5 })],
      bundle(),
    );
    expect(dropped.kept).toHaveLength(0);
    expect(dropped.droppedCount).toBe(1);
  });

  it('never mutates the input array', () => {
    const input = [
      detection({ confidence: 0.1 }),
      detection({ confidence: 0.9 }),
    ];
    const copy = [...input];
    filterDetections(input, bundle());
    expect(input).toEqual(copy);
  });
});
