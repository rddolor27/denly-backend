import type { DetectionRun } from '@/modules/model-registry/models/detection-run.model.js';
import type { ScanModel, ScanPage } from '../models/scan.model.js';

export interface ScanHistoryQuery {
  readonly limit: number;
  readonly cursor: string | null;
}

export interface IScansService {
  /** Registry check, then ingredient intelligence, then one transaction for scan + detections. */
  submit(userId: string, run: DetectionRun): Promise<ScanModel>;
  /** Newest first; throws InvalidScanCursorError. */
  list(userId: string, query: ScanHistoryQuery): Promise<ScanPage>;
  /** Another user's scan is reported as not found. */
  findOne(userId: string, id: string): Promise<ScanModel>;
}
