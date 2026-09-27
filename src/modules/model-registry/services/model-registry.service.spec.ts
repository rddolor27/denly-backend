import { Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import {
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { ModelVersionStatus } from '../constants/model-registry.constants.js';
import type { ModelClass } from '../entities/model-class.entity.js';
import type { ModelVersion } from '../entities/model-version.entity.js';
import {
  InvalidDetectionError,
  ModelVersionNotFoundError,
  UnsupportedModelVersionError,
} from '../errors/model-registry.errors.js';
import type {
  DetectionRun,
  SubmittedDetection,
} from '../models/detection-run.model.js';
import { ModelRegistryService } from './model-registry.service.js';

const VERSION_ID = 'yolov8n-ingredients-0.1.0';

function modelVersion(
  status: ModelVersionStatus = ModelVersionStatus.SUPPORTED,
): ModelVersion {
  const pairs: [number, string][] = [
    [1, 'tomato'],
    [0, 'egg'],
  ];
  const classes = pairs.map(
    ([classId, className]) =>
      ({ modelVersionId: VERSION_ID, classId, className }) as ModelClass,
  );
  return {
    id: VERSION_ID,
    status,
    taxonomyVersion: '2026.09.2',
    classesSha256: 'abc',
    classCount: classes.length,
    classes,
    createdAt: new Date('2026-09-23T10:00:00.000Z'),
    updatedAt: new Date('2026-09-23T10:00:00.000Z'),
  };
}

function detection(
  overrides: Partial<SubmittedDetection> = {},
): SubmittedDetection {
  return {
    classId: 0,
    className: 'egg',
    bbox: { x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.4 },
    confidence: 0.8,
    modelVersion: VERSION_ID,
    ...overrides,
  };
}

function run(...detections: SubmittedDetection[]): DetectionRun {
  return {
    modelVersion: VERSION_ID,
    imageSize: { w: 1170, h: 2532 },
    latencyMs: 35,
    detections,
  };
}

describe('ModelRegistryService', () => {
  const repositoryMockFactory = () => ({
    findOne: vi.fn(),
    find: vi.fn(),
  });
  let repositoryMock: ReturnType<typeof repositoryMockFactory>;
  let service: ModelRegistryService;
  let warn: MockInstance<Logger['warn']>;

  beforeEach(() => {
    vi.restoreAllMocks();
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    repositoryMock = repositoryMockFactory();
    service = new ModelRegistryService(
      repositoryMock as unknown as Repository<ModelVersion>,
    );
  });

  describe('assertValidRun', () => {
    it('accepts a run that matches its own taxonomy, in one query', async () => {
      repositoryMock.findOne.mockResolvedValue(modelVersion());

      await expect(
        service.assertValidRun(
          run(detection(), detection({ classId: 1, className: 'tomato' })),
        ),
      ).resolves.toBeUndefined();
      expect(repositoryMock.findOne).toHaveBeenCalledTimes(1);
      expect(repositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: VERSION_ID },
        relations: { classes: true },
      });
      expect(warn).not.toHaveBeenCalled();
    });

    it('accepts an empty run', async () => {
      repositoryMock.findOne.mockResolvedValue(modelVersion());

      await expect(service.assertValidRun(run())).resolves.toBeUndefined();
    });

    it('rejects an unknown model version', async () => {
      repositoryMock.findOne.mockResolvedValue(null);

      const error: unknown = await service
        .assertValidRun(run(detection()))
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnsupportedModelVersionError);
      expect((error as UnsupportedModelVersionError).details).toEqual({
        modelVersion: VERSION_ID,
        reason: 'unknown',
      });
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('rejects a retired model version', async () => {
      repositoryMock.findOne.mockResolvedValue(
        modelVersion(ModelVersionStatus.RETIRED),
      );

      const error: unknown = await service
        .assertValidRun(run(detection()))
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnsupportedModelVersionError);
      expect((error as UnsupportedModelVersionError).details).toMatchObject({
        reason: 'retired',
      });
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it.each([
      [
        'a class pair from another taxonomy',
        detection({ classId: 0, className: 'tomato' }),
        'UNKNOWN_CLASS',
      ],
      [
        'a mismatched per-detection model version',
        detection({ modelVersion: 'yolov8n-ingredients-0.0.9' }),
        'MODEL_VERSION_MISMATCH',
      ],
      [
        'an inverted bounding box',
        detection({ bbox: { x1: 0.4, y1: 0.1, x2: 0.1, y2: 0.4 } }),
        'INVALID_BBOX',
      ],
    ])('rejects %s', async (_label, bad, reason) => {
      repositoryMock.findOne.mockResolvedValue(modelVersion());

      const error: unknown = await service
        .assertValidRun(run(detection(), bad))
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InvalidDetectionError);
      expect((error as InvalidDetectionError).details).toEqual({
        issueCount: 1,
        issues: [{ index: 1, reason }],
      });
      expect(warn).toHaveBeenCalledWith(
        `[assertValidRun] rejected: 1 issues in 2 detections for model version ${VERSION_ID}`,
      );
    });
  });

  describe('list', () => {
    it('returns every version newest first, without classes', async () => {
      const { classes: _classes, ...withoutClasses } = modelVersion();
      repositoryMock.find.mockResolvedValue([withoutClasses]);

      const versions = await service.list();

      expect(repositoryMock.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC', id: 'ASC' },
      });
      expect(versions).toHaveLength(1);
      expect(versions[0]?.id).toBe(VERSION_ID);
      expect(versions[0]?.classes).toBeNull();
    });
  });

  describe('findOne', () => {
    it('returns the version with classes ordered by class id', async () => {
      repositoryMock.findOne.mockResolvedValue(modelVersion());

      const version = await service.findOne(VERSION_ID);

      expect(version.classes).toEqual([
        { classId: 0, className: 'egg' },
        { classId: 1, className: 'tomato' },
      ]);
    });

    it('throws ModelVersionNotFoundError for an unknown id', async () => {
      repositoryMock.findOne.mockResolvedValue(null);

      await expect(service.findOne('nope-1.0.0')).rejects.toBeInstanceOf(
        ModelVersionNotFoundError,
      );
    });
  });
});
