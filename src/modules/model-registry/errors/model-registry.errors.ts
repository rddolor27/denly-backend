import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@/commons/errors/domain.error.js';
import { MAX_REPORTED_ISSUES } from '../constants/model-registry.constants.js';
import type { RunIssue } from '../models/detection-run.model.js';

export class UnsupportedModelVersionError extends DomainError {
  constructor(modelVersion: string, reason: 'unknown' | 'retired') {
    super(
      'UNSUPPORTED_MODEL_VERSION',
      `Model version ${modelVersion} is not supported`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { modelVersion, reason },
    );
  }
}

export class InvalidDetectionError extends DomainError {
  constructor(issues: readonly RunIssue[]) {
    super(
      'INVALID_DETECTION',
      'The detection run does not match its model version',
      HttpStatus.UNPROCESSABLE_ENTITY,
      {
        issueCount: issues.length,
        issues: issues.slice(0, MAX_REPORTED_ISSUES),
      },
    );
  }
}

export class ModelVersionNotFoundError extends DomainError {
  constructor(id: string) {
    super(
      'MODEL_VERSION_NOT_FOUND',
      `Model version ${id} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ModelVersionImportError extends DomainError {
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super(
      'MODEL_VERSION_IMPORT_INVALID',
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }
}
