import type { DetectionRun } from '../models/detection-run.model.js';
import type { ModelVersionModel } from '../models/model-version.model.js';

export interface IModelRegistryService {
  /** Resolves when the run is acceptable; throws UnsupportedModelVersionError or InvalidDetectionError. */
  assertValidRun(run: DetectionRun): Promise<void>;
  list(): Promise<readonly ModelVersionModel[]>;
  /** With classes loaded; throws ModelVersionNotFoundError. */
  findOne(id: string): Promise<ModelVersionModel>;
}
