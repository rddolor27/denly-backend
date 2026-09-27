import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type Provider } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { DataSource, Repository } from 'typeorm';
import { InjectIngredientIntelligenceService } from '@/modules/ingredient-intelligence/constants/ingredient-intelligence.constants.js';
import type { IIngredientIntelligenceService } from '@/modules/ingredient-intelligence/interfaces/ingredient-intelligence-service.interface.js';
import { InjectModelRegistryService } from '@/modules/model-registry/constants/model-registry.constants.js';
import type { IModelRegistryService } from '@/modules/model-registry/interfaces/model-registry-service.interface.js';
import type {
  BoundingBox,
  DetectionRun,
} from '@/modules/model-registry/models/detection-run.model.js';
import { AnalysisStatus, SCANS_SERVICE } from '../constants/scans.constants.js';
import { Detection } from '../entities/detection.entity.js';
import { Scan } from '../entities/scan.entity.js';
import { ScanNotFoundError } from '../errors/scans.errors.js';
import type {
  IScansService,
  ScanHistoryQuery,
} from '../interfaces/scans-service.interface.js';
import {
  ScanModel,
  type ScanPage,
  ScanSummaryModel,
} from '../models/scan.model.js';
import { decodeScanCursor, encodeScanCursor } from '../utils/scan-cursor.js';

interface SubmittedDetectionRecord {
  readonly id: string;
  readonly position: number;
  readonly classId: number;
  readonly className: string;
  readonly bbox: BoundingBox;
  readonly confidence: number;
}

@Injectable()
export class ScansService implements IScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    @InjectModelRegistryService()
    private readonly registry: IModelRegistryService,
    @InjectIngredientIntelligenceService()
    private readonly intelligence: IIngredientIntelligenceService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Scan) private readonly scans: Repository<Scan>,
  ) {}

  async submit(userId: string, run: DetectionRun): Promise<ScanModel> {
    await this.registry.assertValidRun(run);

    const scanId = randomUUID();
    const detections: SubmittedDetectionRecord[] = run.detections.map(
      (detection, position) => ({
        id: randomUUID(),
        position,
        classId: detection.classId,
        className: detection.className,
        bbox: detection.bbox,
        confidence: detection.confidence,
      }),
    );

    const result = await this.intelligence.build(
      scanId,
      detections.map(({ id, className, confidence }) => ({
        id,
        className,
        confidence,
      })),
    );

    await this.dataSource.transaction(async (manager) => {
      await manager.insert(Scan, {
        id: scanId,
        userId,
        modelVersionId: run.modelVersion,
        imageWidth: run.imageSize.w,
        imageHeight: run.imageSize.h,
        latencyMs: run.latencyMs,
        rulesVersion: result.rulesVersion,
        // No LLM stage exists yet (provider undecided) — analysis is unavailable from the start.
        promptVersion: null,
        result,
        analysisStatus: AnalysisStatus.UNAVAILABLE,
        analysis: null,
      });

      if (detections.length > 0) {
        await manager.insert(
          Detection,
          detections.map((detection) => ({
            id: detection.id,
            scanId,
            position: detection.position,
            modelVersionId: run.modelVersion,
            classId: detection.classId,
            className: detection.className,
            x1: detection.bbox.x1,
            y1: detection.bbox.y1,
            x2: detection.bbox.x2,
            y2: detection.bbox.y2,
            confidence: detection.confidence,
          })),
        );
      }
    });

    this.logger.log(
      `[submit] scan=${scanId} modelVersion=${run.modelVersion} detections=${detections.length} ingredients=${result.ingredients.length} unknowns=${result.unknowns.length}`,
    );

    return this.findOne(userId, scanId);
  }

  async list(userId: string, query: ScanHistoryQuery): Promise<ScanPage> {
    const qb = this.scans
      .createQueryBuilder('scan')
      .where('scan.userId = :userId', { userId })
      .orderBy('scan.createdAt', 'DESC')
      .addOrderBy('scan.id', 'DESC')
      .limit(query.limit + 1);
    if (query.cursor !== null) {
      const cursor = decodeScanCursor(query.cursor);
      qb.andWhere('(scan.created_at, scan.id) < (:createdAt, :id)', {
        createdAt: cursor.createdAt,
        id: cursor.id,
      });
    }
    const rows = await qb.getMany();
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map((scan) => ScanSummaryModel.fromEntity(scan)),
      nextCursor:
        rows.length > query.limit && last
          ? encodeScanCursor({ createdAt: last.createdAt, id: last.id })
          : null,
    };
  }

  async findOne(userId: string, id: string): Promise<ScanModel> {
    const scan = await this.scans.findOne({
      where: { id, userId },
      relations: { detections: true },
    });
    if (!scan) {
      throw new ScanNotFoundError(id);
    }
    return ScanModel.fromEntity(scan, scan.detections);
  }
}

export const ScansProvider: Provider = {
  provide: SCANS_SERVICE,
  useClass: ScansService,
};
