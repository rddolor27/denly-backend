import type { DetectionRun, RunIssue } from '../models/detection-run.model.js';

export function findRunIssues(
  run: DetectionRun,
  classes: ReadonlyMap<number, string>,
): RunIssue[] {
  const issues: RunIssue[] = [];
  run.detections.forEach((detection, index) => {
    if (
      detection.modelVersion !== null &&
      detection.modelVersion !== run.modelVersion
    ) {
      issues.push({ index, reason: 'MODEL_VERSION_MISMATCH' });
    }
    if (classes.get(detection.classId) !== detection.className) {
      issues.push({ index, reason: 'UNKNOWN_CLASS' });
    }
    const { x1, y1, x2, y2 } = detection.bbox;
    if (!(x1 < x2 && y1 < y2)) {
      issues.push({ index, reason: 'INVALID_BBOX' });
    }
  });
  return issues;
}
