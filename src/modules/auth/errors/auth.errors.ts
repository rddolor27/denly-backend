import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@/commons/errors/domain.error.js';

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super(
      'INVALID_CREDENTIALS',
      'Email or password is incorrect',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class InvalidRefreshTokenError extends DomainError {
  constructor() {
    super(
      'INVALID_REFRESH_TOKEN',
      'Refresh token is invalid, expired or revoked',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class AuthenticationRequiredError extends DomainError {
  constructor() {
    super(
      'AUTHENTICATION_REQUIRED',
      'An access token is required',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class AccessTokenExpiredError extends DomainError {
  constructor() {
    super(
      'ACCESS_TOKEN_EXPIRED',
      'Access token has expired',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class InvalidAccessTokenError extends DomainError {
  constructor() {
    super(
      'INVALID_ACCESS_TOKEN',
      'Access token is invalid',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
