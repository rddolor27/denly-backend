import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource, Repository } from 'typeorm';
import type { IIngredientIntelligenceService } from '@/modules/ingredient-intelligence/interfaces/ingredient-intelligence-service.interface.js';
import { UnsupportedModelVersionError } from '@/modules/model-registry/errors/model-registry.errors.js';
import type { IModelRegistryService } from '@/modules/model-registry/interfaces/model-registry-service.interface.js';
import type { DetectionRun } from '@/modules/model-registry/models/detection-run.model.js';
import { AnalysisStatus } from '../constants/scans.constants.js';
import { Detection } from '../entities/detection.entity.js';
import { Scan } from '../entities/scan.entity.js';
import {
  InvalidScanCursorError,
  ScanNotFoundError,
} from '../errors/scans.errors.js';
import { ScansService } from './scans.service.js';

const USER_ID = '0b6f4c1e-3f7a-4d2b-9a51-8c2d7e6f1a20';

function fixtureRun(overrides: Partial<DetectionRun> = {}): DetectionRun {
  return {
    modelVersion: 'yolov8n-ingredients-0.1.0',
    imageSize: { w: 640, h: 480 },
    latencyMs: 120,
    detections: [
      {
        classId: 1,
        className: 'egg',
        bbox: { x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.5 },
        confidence: 0.9,
        modelVersion: null,
      },
    ],
    ...overrides,
  };
}

describe('ScansService', () => {
  let registry: { assertValidRun: ReturnType<typeof vi.fn> };
  let intelligence: { build: ReturnType<typeof vi.fn>; rulesVersion: string };
  let manager: { insert: ReturnType<typeof vi.fn> };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let scansRepo: { findOne: ReturnType<typeof vi.fn> };
  let service: ScansService;

  beforeEach(() => {
    registry = { assertValidRun: vi.fn().mockResolvedValue(undefined) };
    intelligence = {
      build: vi.fn().mockResolvedValue({
        scanId: 'scan-1',
        rulesVersion: 'rules-test-1',
        ingredients: [],
        unknowns: [],
        flags: [],
      }),
      rulesVersion: 'rules-test-1',
    };
    manager = { insert: vi.fn().mockResolvedValue(undefined) };
    dataSource = {
      transaction: vi.fn(
        async (callback: (m: typeof manager) => Promise<void>) => {
          await callback(manager);
        },
      ),
    };
    scansRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: 'scan-1',
        createdAt: new Date('2026-09-23T00:00:00.000Z'),
        modelVersionId: 'yolov8n-ingredients-0.1.0',
        imageWidth: 640,
        imageHeight: 480,
        latencyMs: 120,
        rulesVersion: 'rules-test-1',
        promptVersion: null,
        result: {
          scanId: 'scan-1',
          rulesVersion: 'rules-test-1',
          ingredients: [],
          unknowns: [],
          flags: [],
        },
        analysisStatus: AnalysisStatus.UNAVAILABLE,
        analysis: null,
        detections: [],
      }),
    };

    service = new ScansService(
      registry as unknown as IModelRegistryService,
      intelligence as unknown as IIngredientIntelligenceService,
      dataSource as unknown as DataSource,
      scansRepo as unknown as Repository<Scan>,
    );
  });

  it('rejects a run the registry does not accept before inserting anything', async () => {
    registry.assertValidRun.mockRejectedValue(
      new UnsupportedModelVersionError('yolov8n-ingredients-9.9.9', 'unknown'),
    );

    await expect(service.submit(USER_ID, fixtureRun())).rejects.toBeInstanceOf(
      UnsupportedModelVersionError,
    );
    expect(intelligence.build).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('inserts the scan then its detections in one transaction and returns the persisted scan', async () => {
    const result = await service.submit(USER_ID, fixtureRun());

    expect(registry.assertValidRun).toHaveBeenCalledWith(fixtureRun());
    expect(intelligence.build).toHaveBeenCalledTimes(1);

    const [, detectionsArg] = intelligence.build.mock.calls[0] as [
      string,
      { id: string; className: string; confidence: number }[],
    ];
    expect(detectionsArg).toEqual([
      { id: expect.any(String) as string, className: 'egg', confidence: 0.9 },
    ]);

    expect(manager.insert).toHaveBeenCalledTimes(2);

    const [scanEntity, scanPayload] = manager.insert.mock.calls[0] as [
      typeof Scan,
      Record<string, unknown>,
    ];
    expect(scanEntity).toBe(Scan);
    expect(scanPayload.analysisStatus).toBe(AnalysisStatus.UNAVAILABLE);
    expect(scanPayload.promptVersion).toBeNull();
    expect(scanPayload.rulesVersion).toBe('rules-test-1');
    expect(scanPayload.userId).toBe(USER_ID);

    const [detectionEntity, detectionPayload] = manager.insert.mock
      .calls[1] as [typeof Detection, Record<string, unknown>[]];
    expect(detectionEntity).toBe(Detection);
    expect(detectionPayload).toHaveLength(1);
    expect(detectionPayload[0]?.position).toBe(0);
    expect(detectionPayload[0]?.id).toBe(detectionsArg[0]?.id);

    expect(scansRepo.findOne).toHaveBeenCalledWith({
      where: { id: expect.any(String) as string, userId: USER_ID },
      relations: { detections: true },
    });
    expect(result.id).toBe('scan-1');
  });

  it('skips the detection insert for an empty run', async () => {
    await service.submit(USER_ID, fixtureRun({ detections: [] }));

    expect(manager.insert).toHaveBeenCalledTimes(1);
  });

  describe('list', () => {
    function historyRow(n: number): Record<string, unknown> {
      return {
        id: `00000000-0000-4000-8000-00000000000${n}`,
        createdAt: new Date(`2026-09-23T00:00:0${n}.000Z`),
        modelVersionId: 'yolov8n-ingredients-0.1.0',
        rulesVersion: 'rules-test-1',
        result: {
          scanId: `scan-${n}`,
          rulesVersion: 'rules-test-1',
          ingredients: [],
          unknowns: [],
          flags: [],
        },
        analysisStatus: AnalysisStatus.UNAVAILABLE,
      };
    }

    function queryBuilderReturning(rows: Record<string, unknown>[]) {
      const qb = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(rows),
      };
      (scansRepo as Record<string, unknown>).createQueryBuilder = vi
        .fn()
        .mockReturnValue(qb);
      return qb;
    }

    it('returns one page scoped to the user and a cursor when more rows exist', async () => {
      const qb = queryBuilderReturning([
        historyRow(3),
        historyRow(2),
        historyRow(1),
      ]);

      const page = await service.list(USER_ID, { limit: 2, cursor: null });

      expect(qb.where).toHaveBeenCalledWith('scan.userId = :userId', {
        userId: USER_ID,
      });
      expect(qb.limit).toHaveBeenCalledWith(3);
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(page.items.map((item) => item.id)).toEqual([
        historyRow(3).id,
        historyRow(2).id,
      ]);
      expect(page.nextCursor).toEqual(expect.any(String));
    });

    it('continues after the cursor and ends with a null cursor', async () => {
      const first = queryBuilderReturning([
        historyRow(3),
        historyRow(2),
        historyRow(1),
      ]);
      const { nextCursor } = await service.list(USER_ID, {
        limit: 2,
        cursor: null,
      });
      expect(first.getMany).toHaveBeenCalled();

      const second = queryBuilderReturning([historyRow(1)]);
      const page = await service.list(USER_ID, {
        limit: 2,
        cursor: nextCursor,
      });

      expect(second.andWhere).toHaveBeenCalledWith(
        '(scan.created_at, scan.id) < (:createdAt, :id)',
        { createdAt: historyRow(2).createdAt, id: historyRow(2).id },
      );
      expect(page.items).toHaveLength(1);
      expect(page.nextCursor).toBeNull();
    });

    it('rejects a malformed cursor', async () => {
      queryBuilderReturning([]);

      await expect(
        service.list(USER_ID, { limit: 2, cursor: 'bm90LWEtY3Vyc29y' }),
      ).rejects.toBeInstanceOf(InvalidScanCursorError);
    });
  });

  it('throws ScanNotFoundError when the scan does not exist', async () => {
    scansRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne(USER_ID, 'missing')).rejects.toBeInstanceOf(
      ScanNotFoundError,
    );
  });
});
