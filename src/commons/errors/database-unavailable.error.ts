import { HttpStatus } from '@nestjs/common';
import { DomainError } from './domain.error.js';

/** Thrown by `HealthService` when the database ping fails. Never leaks the driver's raw message. */
export class DatabaseUnavailableError extends DomainError {
  constructor() {
    super(
      'DATABASE_UNAVAILABLE',
      'Database is not reachable',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
