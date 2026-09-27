export interface BoundingBox {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface ImageSize {
  readonly w: number;
  readonly h: number;
}

export interface SubmittedDetection {
  readonly classId: number;
  readonly className: string;
  readonly bbox: BoundingBox;
  readonly confidence: number;
  readonly modelVersion: string | null;
}

// The device's DetectionRun (ADR 0002) after DTO validation, before the registry check.
export interface DetectionRun {
  readonly modelVersion: string;
  readonly imageSize: ImageSize;
  readonly latencyMs: number;
  readonly detections: readonly SubmittedDetection[];
}

export type RunIssueReason =
  'UNKNOWN_CLASS' | 'INVALID_BBOX' | 'MODEL_VERSION_MISMATCH';

export interface RunIssue {
  readonly index: number;
  readonly reason: RunIssueReason;
}
