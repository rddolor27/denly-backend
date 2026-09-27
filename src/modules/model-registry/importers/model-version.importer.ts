import { type EntityManager, In } from 'typeorm';
import { AliasSource } from '@/modules/ingredients/constants/ingredients.constants.js';
import { IngredientAlias } from '@/modules/ingredients/entities/ingredient-alias.entity.js';
import { normalizeAlias } from '@/modules/ingredients/utils/normalize-alias.js';
import {
  MODEL_VERSION_PATTERN,
  type ModelVersionStatus,
} from '../constants/model-registry.constants.js';
import { ModelClass } from '../entities/model-class.entity.js';
import { ModelVersion } from '../entities/model-version.entity.js';
import { ModelVersionImportError } from '../errors/model-registry.errors.js';
import type { ModelClassEntry } from './classes-file.parser.js';

export interface ModelVersionImportInput {
  readonly id: string;
  readonly classes: readonly ModelClassEntry[];
  readonly classesSha256: string;
  readonly taxonomyVersion: string | null;
  readonly status: ModelVersionStatus;
}

export interface ModelVersionImportSummary {
  readonly id: string;
  readonly created: boolean;
  readonly status: ModelVersionStatus;
  readonly classCount: number;
}

function pairKey(entry: ModelClassEntry): string {
  return `${entry.classId}:${entry.className}`;
}

async function assertClassesResolve(
  manager: EntityManager,
  classes: readonly ModelClassEntry[],
): Promise<void> {
  const keys = [...new Set(classes.map((c) => normalizeAlias(c.className)))];
  const aliases = await manager.find(IngredientAlias, {
    select: { aliasNormalized: true },
    where: { source: AliasSource.MODEL_CLASS, aliasNormalized: In(keys) },
  });
  const resolved = new Set(aliases.map((alias) => alias.aliasNormalized));
  const unresolved = classes
    .filter((c) => !resolved.has(normalizeAlias(c.className)))
    .map((c) => c.className);
  if (unresolved.length > 0) {
    throw new ModelVersionImportError(
      'model classes without a canonical ingredient',
      { unresolved },
    );
  }
}

// A model version's classes never change once registered; only its status and metadata do.
export async function importModelVersion(
  manager: EntityManager,
  input: ModelVersionImportInput,
): Promise<ModelVersionImportSummary> {
  if (!MODEL_VERSION_PATTERN.test(input.id)) {
    throw new ModelVersionImportError('invalid model version id', {
      id: input.id,
      pattern: MODEL_VERSION_PATTERN.source,
    });
  }
  if (input.classes.length === 0) {
    throw new ModelVersionImportError('a model version needs classes', {
      id: input.id,
    });
  }
  await assertClassesResolve(manager, input.classes);

  const existing = await manager.findOne(ModelVersion, {
    where: { id: input.id },
    relations: { classes: true },
  });

  if (existing) {
    const stored = new Set(existing.classes.map(pairKey));
    const incoming = new Set(input.classes.map(pairKey));
    const added = [...incoming].filter((key) => !stored.has(key));
    const removed = [...stored].filter((key) => !incoming.has(key));
    if (added.length > 0 || removed.length > 0) {
      throw new ModelVersionImportError('model version classes are immutable', {
        id: input.id,
        added,
        removed,
      });
    }
    await manager.update(
      ModelVersion,
      { id: input.id },
      {
        status: input.status,
        classesSha256: input.classesSha256,
        ...(input.taxonomyVersion !== null
          ? { taxonomyVersion: input.taxonomyVersion }
          : {}),
      },
    );
    return {
      id: input.id,
      created: false,
      status: input.status,
      classCount: existing.classes.length,
    };
  }

  await manager.insert(ModelVersion, {
    id: input.id,
    status: input.status,
    taxonomyVersion: input.taxonomyVersion,
    classesSha256: input.classesSha256,
    classCount: input.classes.length,
  });
  await manager.insert(
    ModelClass,
    input.classes.map((c) => ({
      modelVersionId: input.id,
      classId: c.classId,
      className: c.className,
    })),
  );
  return {
    id: input.id,
    created: true,
    status: input.status,
    classCount: input.classes.length,
  };
}
