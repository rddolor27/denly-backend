import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Logger } from '@nestjs/common';
import { DomainError } from '@/commons/errors/domain.error.js';
import { ModelVersionStatus } from '@/modules/model-registry/constants/model-registry.constants.js';
import { ModelVersionImportError } from '@/modules/model-registry/errors/model-registry.errors.js';
import { parseClassesFile } from '@/modules/model-registry/importers/classes-file.parser.js';
import { importModelVersion } from '@/modules/model-registry/importers/model-version.importer.js';
import dataSource from '../data-source.js';

const logger = new Logger('RegistryImport');

const STATUSES: readonly string[] = Object.values(ModelVersionStatus);

function parseStatus(value: string): ModelVersionStatus {
  if (!STATUSES.includes(value)) {
    throw new ModelVersionImportError('invalid --status', {
      status: value,
      allowed: STATUSES,
    });
  }
  return value as ModelVersionStatus;
}

async function importFromArgs(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'model-version': { type: 'string' },
      classes: { type: 'string' },
      status: { type: 'string', default: ModelVersionStatus.SUPPORTED },
      'taxonomy-version': { type: 'string' },
    },
  });
  const id = values['model-version'];
  const classesPath = values.classes;
  if (id === undefined || classesPath === undefined) {
    throw new ModelVersionImportError(
      'usage: registry:import --model-version <id> --classes <path> [--status supported|retired] [--taxonomy-version <v>]',
    );
  }
  const status = parseStatus(values.status);

  const bytes = readFileSync(resolve(process.cwd(), classesPath));
  const classes = parseClassesFile(bytes.toString('utf8'));
  const classesSha256 = createHash('sha256').update(bytes).digest('hex');

  try {
    await dataSource.initialize();
    const summary = await dataSource.transaction((manager) =>
      importModelVersion(manager, {
        id,
        classes,
        classesSha256,
        taxonomyVersion: values['taxonomy-version'] ?? null,
        status,
      }),
    );
    logger.log(
      `[importFromArgs] ${summary.created ? 'registered' : 'updated'} ${summary.id}: ${summary.status}, ${summary.classCount} classes, sha256 ${classesSha256}`,
    );
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

importFromArgs().catch((error: unknown) => {
  logger.error(
    `[importFromArgs] failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  if (error instanceof DomainError && error.details !== undefined) {
    logger.error(`[importFromArgs] details: ${JSON.stringify(error.details)}`);
  }
  process.exitCode = 1;
});
