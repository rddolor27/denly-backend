import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelVersionStatus } from '../constants/model-registry.constants.js';
import { ModelVersionParamDTO } from '../dtos/model-version-param.dto.js';
import { ModelVersionNotFoundError } from '../errors/model-registry.errors.js';
import { ModelVersionModel } from '../models/model-version.model.js';
import { ModelRegistryController } from './model-registry.controller.js';

function versionModel(
  classes: ModelVersionModel['classes'],
): ModelVersionModel {
  return Object.assign(new ModelVersionModel(), {
    id: 'yolov8n-ingredients-0.1.0',
    status: ModelVersionStatus.SUPPORTED,
    taxonomyVersion: '2026.09.2',
    classesSha256: 'abc123',
    classCount: 2,
    classes,
    createdAt: new Date('2026-09-23T10:00:00.000Z'),
    updatedAt: new Date('2026-09-23T11:00:00.000Z'),
  });
}

describe('ModelRegistryController', () => {
  const serviceMockFactory = () => ({
    assertValidRun: vi.fn(),
    list: vi.fn(),
    findOne: vi.fn(),
  });
  let serviceMock: ReturnType<typeof serviceMockFactory>;
  let controller: ModelRegistryController;

  beforeEach(() => {
    serviceMock = serviceMockFactory();
    controller = new ModelRegistryController(serviceMock);
  });

  it('maps every version with an ISO creation date', async () => {
    serviceMock.list.mockResolvedValue([versionModel(null)]);

    await expect(controller.list()).resolves.toEqual([
      {
        id: 'yolov8n-ingredients-0.1.0',
        status: ModelVersionStatus.SUPPORTED,
        taxonomyVersion: '2026.09.2',
        classCount: 2,
        classesSha256: 'abc123',
        createdAt: '2026-09-23T10:00:00.000Z',
      },
    ]);
  });

  it('maps one version with its classes', async () => {
    serviceMock.findOne.mockResolvedValue(
      versionModel([
        { classId: 0, className: 'egg' },
        { classId: 1, className: 'tomato' },
      ]),
    );
    const params = Object.assign(new ModelVersionParamDTO(), {
      id: 'yolov8n-ingredients-0.1.0',
    });

    const result = await controller.findOne(params);

    expect(serviceMock.findOne).toHaveBeenCalledWith(
      'yolov8n-ingredients-0.1.0',
    );
    expect(result.classes).toEqual([
      { classId: 0, className: 'egg' },
      { classId: 1, className: 'tomato' },
    ]);
  });

  it('propagates ModelVersionNotFoundError', async () => {
    serviceMock.findOne.mockRejectedValue(new ModelVersionNotFoundError('x'));

    await expect(
      controller.findOne(
        Object.assign(new ModelVersionParamDTO(), { id: 'x' }),
      ),
    ).rejects.toBeInstanceOf(ModelVersionNotFoundError);
  });
});
