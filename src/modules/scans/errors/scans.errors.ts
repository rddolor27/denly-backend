import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@/commons/errors/domain.error.js';

export class ScanNotFoundError extends DomainError {
  constructor(id: string) {
    super('SCAN_NOT_FOUND', `Scan ${id} not found`, HttpStatus.NOT_FOUND);
  }
}

export class InvalidScanCursorError extends DomainError {
  constructor() {
    super('INVALID_CURSOR', 'The cursor is malformed', HttpStatus.BAD_REQUEST);
  }
}
