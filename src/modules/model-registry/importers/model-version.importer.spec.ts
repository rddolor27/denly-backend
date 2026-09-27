import { type EntityManager, In } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AliasSource } from '@/modules/ingredients/constants/ingredients.constants.js';
import { IngredientAlias } from '@/modules/ingredients/entities/ingredient-alias.entity.js';
import { ModelVersionStatus } from '../constants/model-registry.constants.js';
import { ModelClass } from '../entities/model-class.entity.js';
import { ModelVersion } from '../entities/model-version.entity.js';
import { ModelVersionImportError } from '../errors/model-registry.errors.js';
import type { ModelClassEntry } from './classes-file.parser.js';
import {
  importModelVersion,
  type ModelVersionImportInput,
} from './model-version.importer.js';

const CLASSES: ModelClassEntry[] = [
  { classId: 0, className: 'egg' },
  { classId: 1, className: 'sweet_potato' },
];

function input(
  overrides: Partial<ModelVersionImportInput> = {},
): ModelVersionImportInput {
  return {
    id: 'yolov8n-ingredients-0.1.0',
    classes: CLASSES,
    classesSha256: 'sha',
    taxonomyVersion: null,
    status: ModelVersionStatus.SUPPORTED,
    ...overrides,
  };
}

async function importError(
  manager: unknown,
  value: ModelVersionImportInput,
): Promise<ModelVersionImportError> {
  const error: unknown = await importModelVersion(
    manager as EntityManager,
    value,
  ).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ModelVersionImportError);
  return error as ModelVersionImportError;
}

describe('importModelVersion', () => {
  const managerMockFactory = () => ({
    find: vi.fn(),
    findOne: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  });
  let manager: ReturnType<typeof managerMockFactory>;

  beforeEach(() => {
    manager = managerMockFactory();
    manager.find.mockResolvedValue([
      { aliasNormalized: 'egg' },
      { aliasNormalized: 'sweet potato' },
    ]);
    manager.findOne.mockResolvedValue(null);
  });

  it('registers a new version with its classes', async () => {
    const summary = await importModelVersion(
      manager as unknown as EntityManager,
      input({ taxonomyVersion: '2026.09.2' }),
    );

    expect(manager.find).toHaveBeenCalledWith(IngredientAlias, {
      select: { aliasNormalized: true },
      where: {
        source: AliasSource.MODEL_CLASS,
        aliasNormalized: In(['egg', 'sweet potato']),
      },
    });
    expect(manager.insert).toHaveBeenNthCalledWith(1, ModelVersion, {
      id: 'yolov8n-ingredients-0.1.0',
      status: ModelVersionStatus.SUPPORTED,
      taxonomyVersion: '2026.09.2',
      classesSha256: 'sha',
      classCount: 2,
    });
    expect(manager.insert).toHaveBeenNthCalledWith(2, ModelClass, [
      {
        modelVersionId: 'yolov8n-ingredients-0.1.0',
        classId: 0,
        className: 'egg',
      },
      {
        modelVersionId: 'yolov8n-ingredients-0.1.0',
        classId: 1,
        className: 'sweet_potato',
      },
    ]);
    expect(summary).toEqual({
      id: 'yolov8n-ingredients-0.1.0',
      created: true,
      status: ModelVersionStatus.SUPPORTED,
      classCount: 2,
    });
  });

  it('rejects an id that does not match the model version pattern', async () => {
    const error = await importError(manager, input({ id: 'YOLO v8' }));

    expect(error.message).toBe('invalid model version id');
    expect(manager.find).not.toHaveBeenCalled();
  });

  it('rejects classes that no model_class alias resolves', async () => {
    manager.find.mockResolvedValue([{ aliasNormalized: 'egg' }]);

    const error = await importError(manager, input());

    expect(error.message).toBe('model classes without a canonical ingredient');
    expect(error.details).toEqual({ unresolved: ['sweet_potato'] });
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('updates status, checksum and taxonomy version of an existing version with the same classes', async () => {
    manager.findOne.mockResolvedValue({
      id: 'yolov8n-ingredients-0.1.0',
      classes: [
        { classId: 1, className: 'sweet_potato' },
        { classId: 0, className: 'egg' },
      ],
    });

    const summary = await importModelVersion(
      manager as unknown as EntityManager,
      input({
        status: ModelVersionStatus.RETIRED,
        classesSha256: 'sha2',
        taxonomyVersion: '2026.09.2',
      }),
    );

    expect(manager.update).toHaveBeenCalledWith(
      ModelVersion,
      { id: 'yolov8n-ingredients-0.1.0' },
      {
        status: ModelVersionStatus.RETIRED,
        classesSha256: 'sha2',
        taxonomyVersion: '2026.09.2',
      },
    );
    expect(manager.insert).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ created: false, classCount: 2 });
  });

  it('keeps the stored taxonomy version when none is given', async () => {
    manager.findOne.mockResolvedValue({
      id: 'yolov8n-ingredients-0.1.0',
      classes: CLASSES,
    });

    await importModelVersion(manager as unknown as EntityManager, input());

    expect(manager.update).toHaveBeenCalledWith(
      ModelVersion,
      { id: 'yolov8n-ingredients-0.1.0' },
      { status: ModelVersionStatus.SUPPORTED, classesSha256: 'sha' },
    );
  });

  it('refuses to change the classes of an existing version', async () => {
    manager.findOne.mockResolvedValue({
      id: 'yolov8n-ingredients-0.1.0',
      classes: [
        { classId: 0, className: 'egg' },
        { classId: 1, className: 'tomato' },
      ],
    });

    const error = await importError(manager, input());

    expect(error.message).toBe('model version classes are immutable');
    expect(error.details).toEqual({
      id: 'yolov8n-ingredients-0.1.0',
      added: ['1:sweet_potato'],
      removed: ['1:tomato'],
    });
    expect(manager.update).not.toHaveBeenCalled();
  });
});
