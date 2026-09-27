import { parse } from 'yaml';
import { CLASS_NAME_PATTERN } from '../constants/model-registry.constants.js';
import { ModelVersionImportError } from '../errors/model-registry.errors.js';

export interface ModelClassEntry {
  readonly classId: number;
  readonly className: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// denly-ml release format: a list of `{ id, name, tier, group }`; only id and name matter here.
export function parseClassesFile(text: string): ModelClassEntry[] {
  let document: unknown;
  try {
    document = parse(text);
  } catch (error) {
    throw new ModelVersionImportError('classes file is not valid YAML', {
      problems: [(error as Error).message],
    });
  }
  if (!Array.isArray(document) || document.length === 0) {
    throw new ModelVersionImportError('invalid classes file', {
      problems: ['the document must be a non-empty list'],
    });
  }

  const problems: string[] = [];
  const entries: ModelClassEntry[] = [];
  const ids = new Set<number>();
  const names = new Set<string>();
  for (const [position, item] of (document as unknown[]).entries()) {
    const where = `[${position}]`;
    if (!isRecord(item)) {
      problems.push(`${where}: must be a mapping`);
      continue;
    }
    const { id, name } = item;
    const validId = typeof id === 'number' && Number.isInteger(id) && id >= 0;
    const validName = typeof name === 'string' && CLASS_NAME_PATTERN.test(name);
    if (!validId) {
      problems.push(`${where}: id must be a non-negative integer`);
    } else if (ids.has(id)) {
      problems.push(`${where}: duplicate id ${id}`);
    }
    if (!validName) {
      problems.push(`${where}: name must match ${CLASS_NAME_PATTERN.source}`);
    } else if (names.has(name)) {
      problems.push(`${where}: duplicate name ${name}`);
    }
    if (validId && validName) {
      ids.add(id);
      names.add(name);
      entries.push({ classId: id, className: name });
    }
  }

  if (problems.length > 0) {
    throw new ModelVersionImportError('invalid classes file', { problems });
  }
  return entries;
}
