import type { StructuredIngredientData } from '@/modules/ingredient-intelligence/models/structured-ingredient-data.model.js';
import type {
  BoundingBox,
  ImageSize,
} from '@/modules/model-registry/models/detection-run.model.js';
import type { AnalysisStatus } from '../constants/scans.constants.js';
import type { Detection } from '../entities/detection.entity.js';
import type { Scan } from '../entities/scan.entity.js';

export interface DetectionModel {
  readonly id: string;
  readonly position: number;
  readonly classId: number;
  readonly className: string;
  readonly bbox: BoundingBox;
  readonly confidence: number;
}

export class ScanSummaryModel {
  readonly id!: string;
  readonly createdAt!: Date;
  readonly modelVersion!: string;
  readonly rulesVersion!: string;
  readonly result!: StructuredIngredientData;
  readonly analysisStatus!: AnalysisStatus;

  static fromEntity(scan: Scan): ScanSummaryModel {
    return Object.assign(new ScanSummaryModel(), {
      id: scan.id,
      createdAt: scan.createdAt,
      modelVersion: scan.modelVersionId,
      rulesVersion: scan.rulesVersion,
      result: scan.result,
      analysisStatus: scan.analysisStatus,
    });
  }
}

export interface ScanPage {
  readonly items: readonly ScanSummaryModel[];
  readonly nextCursor: string | null;
}

export class ScanModel {
  readonly id!: string;
  readonly createdAt!: Date;
  readonly modelVersion!: string;
  readonly rulesVersion!: string;
  readonly promptVersion!: string | null;
  readonly imageSize!: ImageSize;
  readonly latencyMs!: number;
  readonly detections!: readonly DetectionModel[];
  readonly result!: StructuredIngredientData;
  readonly analysisStatus!: AnalysisStatus;
  readonly analysis!: Readonly<Record<string, unknown>> | null;

  static fromEntity(scan: Scan, detections: readonly Detection[]): ScanModel {
    return Object.assign(new ScanModel(), {
      id: scan.id,
      createdAt: scan.createdAt,
      modelVersion: scan.modelVersionId,
      rulesVersion: scan.rulesVersion,
      promptVersion: scan.promptVersion,
      imageSize: { w: scan.imageWidth, h: scan.imageHeight },
      latencyMs: scan.latencyMs,
      detections: [...detections]
        .sort((a, b) => a.position - b.position)
        .map((d) => ({
          id: d.id,
          position: d.position,
          classId: d.classId,
          className: d.className,
          bbox: { x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 },
          confidence: d.confidence,
        })),
      result: scan.result,
      analysisStatus: scan.analysisStatus,
      analysis: scan.analysis,
    });
  }
}
