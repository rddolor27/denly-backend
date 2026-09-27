import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Logger } from '@nestjs/common';
import { DomainError } from '@/commons/errors/domain.error.js';
import {
  buildCatalog,
  parseOverlay,
} from '@/modules/ingredients/importers/catalog.builder.js';
import { importCatalog } from '@/modules/ingredients/importers/catalog.importer.js';
import { parseTaxonomy } from '@/modules/ingredients/importers/taxonomy.parser.js';
import dataSource from '../data-source.js';

const logger = new Logger('Seed');

async function runSeed(): Promise<void> {
  const { values } = parseArgs({
    options: {
      taxonomy: {
        type: 'string',
        default: join(import.meta.dirname, 'data', 'taxonomy.yaml'),
      },
      overlay: {
        type: 'string',
        default: join(import.meta.dirname, 'data', 'ingredient-overlay.json'),
      },
    },
  });

  const taxonomy = parseTaxonomy(
    readFileSync(resolve(process.cwd(), values.taxonomy), 'utf8'),
  );
  const overlay = parseOverlay(
    JSON.parse(readFileSync(resolve(process.cwd(), values.overlay), 'utf8')),
  );
  const rows = buildCatalog(taxonomy, overlay);

  try {
    await dataSource.initialize();
    const summary = await dataSource.transaction((manager) =>
      importCatalog(manager, rows),
    );
    logger.log(
      `[runSeed] taxonomy ${summary.taxonomyVersion}: ${summary.ingredients} ingredients, ${summary.aliases} aliases, ${summary.removedAliases} stale aliases removed`,
    );
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

runSeed().catch((error: unknown) => {
  logger.error(
    `[runSeed] failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  if (error instanceof DomainError && error.details !== undefined) {
    logger.error(`[runSeed] details: ${JSON.stringify(error.details)}`);
  }
  process.exitCode = 1;
});
