import { Inject } from '@nestjs/common';

export const AUTH_SERVICE = Symbol('AUTH_SERVICE');
export const InjectAuthService = (): ParameterDecorator => Inject(AUTH_SERVICE);

export const JWT_ISSUER = 'denly-api';
export const JWT_AUDIENCE = 'denly-mobile';
export const JWT_ALGORITHM = 'HS256';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const REFRESH_TOKEN_BYTES = 32;
export const REFRESH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
