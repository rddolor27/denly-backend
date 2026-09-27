import { describe, expect, it } from 'vitest';
import type {
  DetectionRun,
  SubmittedDetection,
} from '../models/detection-run.model.js';
import { findRunIssues } from './find-run-issues.js';

const VERSION = 'yolov8n-ingredients-0.1.0';
const CLASSES: ReadonlyMap<number, string> = new Map([
  [0, 'egg'],
  [1, 'tomato'],
]);

function detection(
  overrides: Partial<SubmittedDetection> = {},
): SubmittedDetection {
  return {
    classId: 1,
    className: 'tomato',
    bbox: { x1: 0.1, y1: 0.2, x2: 0.5, y2: 0.6 },
    confidence: 0.9,
    modelVersion: VERSION,
    ...overrides,
  };
}

function run(...detections: SubmittedDetection[]): DetectionRun {
  return {
    modelVersion: VERSION,
    imageSize: { w: 1170, h: 2532 },
    latencyMs: 42,
    detections,
  };
}

describe('findRunIssues', () => {
  it('returns no issues for an empty run', () => {
    expect(findRunIssues(run(), CLASSES)).toEqual([]);
  });

  it('accepts detections that match the taxonomy', () => {
    expect(
      findRunIssues(
        run(
          detection(),
          detection({ classId: 0, className: 'egg', modelVersion: null }),
        ),
        CLASSES,
      ),
    ).toEqual([]);
  });

  it('flags a per-detection model version that differs from the run', () => {
    expect(
      findRunIssues(run(detection({ modelVersion: 'other-0.0.1' })), CLASSES),
    ).toEqual([{ index: 0, reason: 'MODEL_VERSION_MISMATCH' }]);
  });

  it('flags an unknown class id and a foreign id/name pair', () => {
    expect(
      findRunIssues(
        run(
          detection({ classId: 7, className: 'tomato' }),
          detection({ classId: 0, className: 'tomato' }),
        ),
        CLASSES,
      ),
    ).toEqual([
      { index: 0, reason: 'UNKNOWN_CLASS' },
      { index: 1, reason: 'UNKNOWN_CLASS' },
    ]);
  });

  it('flags inverted and empty boxes', () => {
    expect(
      findRunIssues(
        run(
          detection({ bbox: { x1: 0.5, y1: 0.2, x2: 0.1, y2: 0.6 } }),
          detection({ bbox: { x1: 0.1, y1: 0.6, x2: 0.5, y2: 0.6 } }),
        ),
        CLASSES,
      ),
    ).toEqual([
      { index: 0, reason: 'INVALID_BBOX' },
      { index: 1, reason: 'INVALID_BBOX' },
    ]);
  });

  it('reports every issue of a detection in a fixed order', () => {
    expect(
      findRunIssues(
        run(
          detection(),
          detection({
            modelVersion: 'other-0.0.1',
            className: 'egg',
            bbox: { x1: 0.9, y1: 0.9, x2: 0.1, y2: 0.1 },
          }),
        ),
        CLASSES,
      ),
    ).toEqual([
      { index: 1, reason: 'MODEL_VERSION_MISMATCH' },
      { index: 1, reason: 'UNKNOWN_CLASS' },
      { index: 1, reason: 'INVALID_BBOX' },
    ]);
  });
});
