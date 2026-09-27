import type { ModelVersionStatus } from '../constants/model-registry.constants.js';
import type { ModelClass } from '../entities/model-class.entity.js';
import type { ModelVersion } from '../entities/model-version.entity.js';

export interface ModelClassModel {
  readonly classId: number;
  readonly className: string;
}

export class ModelVersionModel {
  readonly id!: string;
  readonly status!: ModelVersionStatus;
  readonly taxonomyVersion!: string | null;
  readonly classesSha256!: string;
  readonly classCount!: number;
  // null when the classes relation was not loaded; ordered by classId otherwise.
  readonly classes!: readonly ModelClassModel[] | null;
  readonly createdAt!: Date;
  readonly updatedAt!: Date;

  static fromEntity(entity: ModelVersion): ModelVersionModel {
    return Object.assign(new ModelVersionModel(), {
      id: entity.id,
      status: entity.status,
      taxonomyVersion: entity.taxonomyVersion,
      classesSha256: entity.classesSha256,
      classCount: entity.classCount,
      classes: entity.classes
        ? [...entity.classes]
            .sort((a: ModelClass, b: ModelClass) => a.classId - b.classId)
            .map((c) => ({ classId: c.classId, className: c.className }))
        : null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
