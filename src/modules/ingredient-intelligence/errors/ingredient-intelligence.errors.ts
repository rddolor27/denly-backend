import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@/commons/errors/domain.error.js';

// Raised at boot when the shipped rules bundle fails validation — the app must not start with it.
export class InvalidRulesBundleError extends DomainError {
  constructor(problems: readonly string[]) {
    super(
      'RULES_BUNDLE_INVALID',
      `Rules bundle is invalid: ${problems.join('; ')}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { problems },
    );
  }
}
