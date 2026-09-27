import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@/commons/errors/domain.error.js';

export class EmailAlreadyRegisteredError extends DomainError {
  constructor() {
    super(
      'EMAIL_ALREADY_REGISTERED',
      'An account with this email already exists',
      HttpStatus.CONFLICT,
    );
  }
}

export class UserNotFoundError extends DomainError {
  constructor(id: string) {
    super('USER_NOT_FOUND', `User ${id} not found`, HttpStatus.NOT_FOUND);
  }
}
