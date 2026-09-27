import type { HttpStatus } from '@nestjs/common';

/**
 * Base for every thrown domain error (coding-rules.md: "typed errors with a stable code; never
 * strings, never bare Error in domain code"). `GlobalExceptionFilter` maps this shape to the
 * documented HTTP error response; nothing outside a `catch` that adds context, translates or
 * degrades on purpose should ever catch one of these and swallow it.
 */
export abstract class DomainError extends Error {
  protected constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: HttpStatus,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
