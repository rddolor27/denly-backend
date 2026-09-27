import { randomUUID } from 'node:crypto';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { getRequestId } from '../context/request-context.js';
import type { ErrorResponseDto } from '../dtos/error-response.dto.js';
import { DomainError } from '../errors/domain.error.js';

/**
 * Maps every thrown error to the one documented response shape:
 * `{ statusCode, code, message, details?, requestId, timestamp }`.
 * - `DomainError` (and subclasses) keep their stable `code` and status.
 * - Nest's own `HttpException` (e.g. the `ValidationPipe`'s `BadRequestException`) is translated,
 *   using its class name as a fallback code.
 * - Anything else is unknown: logged with the stack, returned as a 500 with no internals leaked.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = getRequestId() ?? randomUUID();

    const { statusCode, code, message, details } = this.resolve(exception);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[catch] ${request.method} ${request.url} -> ${code}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[catch] ${request.method} ${request.url} -> ${code}: ${message}`,
      );
    }

    const body: ErrorResponseDto = {
      statusCode,
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      requestId,
      timestamp: new Date().toISOString(),
    };
    response.status(statusCode).json(body);
  }

  private resolve(exception: unknown): {
    statusCode: HttpStatus;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } {
    if (exception instanceof DomainError) {
      return {
        statusCode: exception.httpStatus,
        code: exception.code,
        message: exception.message,
        ...(exception.details !== undefined
          ? { details: { ...exception.details } }
          : {}),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const details =
        typeof body === 'object' && body !== null
          ? (body as Record<string, unknown>)
          : undefined;
      return {
        statusCode: status,
        code: this.codeFor(status, exception),
        message: exception.message,
        ...(details !== undefined ? { details } : {}),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  private codeFor(status: HttpStatus, exception: HttpException): string {
    if (status === HttpStatus.BAD_REQUEST) return 'VALIDATION_ERROR';
    if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
    if (status === HttpStatus.UNAUTHORIZED) return 'UNAUTHORIZED';
    if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
    return exception.constructor.name.replace(/Exception$/, '').toUpperCase();
  }
}
