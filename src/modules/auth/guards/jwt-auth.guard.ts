import { type ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import type { AuthenticatedUser } from '@/commons/auth/authenticated-user.js';
import { IS_PUBLIC_KEY } from '@/commons/auth/public.decorator.js';
import { DomainError } from '@/commons/errors/domain.error.js';
import {
  AccessTokenExpiredError,
  AuthenticationRequiredError,
  InvalidAccessTokenError,
} from '../errors/auth.errors.js';

function describeRejection(info: unknown): string {
  return info instanceof Error ? `${info.name}: ${info.message}` : 'no user';
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic === true) return true;
    return super.canActivate(context);
  }

  override handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false | null | undefined,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err instanceof DomainError) {
      this.logger.warn(`[handleRequest] rejected access token: ${err.code}`);
      throw err;
    }
    if (err) {
      this.logger.warn(
        `[handleRequest] rejected access token: ${describeRejection(err)}`,
      );
      throw new InvalidAccessTokenError();
    }
    if (user) return user;

    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers.authorization === undefined) {
      throw new AuthenticationRequiredError();
    }
    this.logger.warn(
      `[handleRequest] rejected access token: ${describeRejection(info)}`,
    );
    if (info instanceof Error && info.name === 'TokenExpiredError') {
      throw new AccessTokenExpiredError();
    }
    throw new InvalidAccessTokenError();
  }
}
