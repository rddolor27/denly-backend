import { Inject } from '@nestjs/common';

export const SCANS_SERVICE = Symbol('SCANS_SERVICE');
export const InjectScansService = (): ParameterDecorator =>
  Inject(SCANS_SERVICE);

export enum AnalysisStatus {
  PENDING = 'pending',
  DONE = 'done',
  UNAVAILABLE = 'unavailable',
}

export const DETECTION_SOURCE_DEVICE = 'device';

export const SCAN_HISTORY_DEFAULT_LIMIT = 20;
export const SCAN_HISTORY_MAX_LIMIT = 50;
