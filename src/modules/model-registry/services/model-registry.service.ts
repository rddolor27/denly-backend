import { Injectable, Logger, type Provider } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MODEL_REGISTRY_SERVICE,
  ModelVersionStatus,
} from '../constants/model-registry.constants.js';
import { ModelVersion } from '../entities/model-version.entity.js';
import {
  InvalidDetectionError,
  ModelVersionNotFoundError,
  UnsupportedModelVersionError,
} from '../errors/model-registry.errors.js';
import type { IModelRegistryService } from '../interfaces/model-registry-service.interface.js';
import type { DetectionRun } from '../models/detection-run.model.js';
import { ModelVersionModel } from '../models/model-version.model.js';
import { findRunIssues } from '../utils/find-run-issues.js';

@Injectable()
export class ModelRegistryService implements IModelRegistryService {
  private readonly logger = new Logger(ModelRegistryService.name);

  constructor(
    @InjectRepository(ModelVersion)
    private readonly modelVersionsRepository: Repository<ModelVersion>,
  ) {}

  async assertValidRun(run: DetectionRun): Promise<void> {
    const version = await this.modelVersionsRepository.findOne({
      where: { id: run.modelVersion },
      relations: { classes: true },
    });
    const detections = run.detections.length;
    if (!version) {
      this.logger.warn(
        `[assertValidRun] rejected: unknown model version ${run.modelVersion} (${detections} detections)`,
      );
      throw new UnsupportedModelVersionError(run.modelVersion, 'unknown');
    }
    if (version.status === ModelVersionStatus.RETIRED) {
      this.logger.warn(
        `[assertValidRun] rejected: retired model version ${run.modelVersion} (${detections} detections)`,
      );
      throw new UnsupportedModelVersionError(run.modelVersion, 'retired');
    }
    const classes = new Map(
      version.classes.map((c) => [c.classId, c.className]),
    );
    const issues = findRunIssues(run, classes);
    if (issues.length > 0) {
      this.logger.warn(
        `[assertValidRun] rejected: ${issues.length} issues in ${detections} detections for model version ${run.modelVersion}`,
      );
      throw new InvalidDetectionError(issues);
    }
  }

  async list(): Promise<readonly ModelVersionModel[]> {
    const versions = await this.modelVersionsRepository.find({
      order: { createdAt: 'DESC', id: 'ASC' },
    });
    return versions.map((version) => ModelVersionModel.fromEntity(version));
  }

  async findOne(id: string): Promise<ModelVersionModel> {
    const version = await this.modelVersionsRepository.findOne({
      where: { id },
      relations: { classes: true },
    });
    if (!version) throw new ModelVersionNotFoundError(id);
    return ModelVersionModel.fromEntity(version);
  }
}

export const ModelRegistryProvider: Provider = {
  provide: MODEL_REGISTRY_SERVICE,
  useClass: ModelRegistryService,
};
