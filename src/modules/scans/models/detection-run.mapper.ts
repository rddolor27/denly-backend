import type { DetectionRun } from '@/modules/model-registry/models/detection-run.model.js';
import type { SubmitScanDTO } from '../dtos/submit-scan.dto.js';

export function toDetectionRun(dto: SubmitScanDTO): DetectionRun {
  return {
    modelVersion: dto.modelVersion,
    imageSize: { w: dto.imageSize.w, h: dto.imageSize.h },
    latencyMs: dto.latencyMs,
    detections: dto.detections.map((detection) => ({
      classId: detection.classId,
      className: detection.className,
      bbox: {
        x1: detection.bbox.x1,
        y1: detection.bbox.y1,
        x2: detection.bbox.x2,
        y2: detection.bbox.y2,
      },
      confidence: detection.confidence,
      modelVersion: detection.modelVersion ?? null,
    })),
  };
}
