import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@/commons/errors/domain.error.js';

export class IngredientNotFoundError extends DomainError {
  constructor(slug: string) {
    super(
      'INGREDIENT_NOT_FOUND',
      `Ingredient ${slug} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class CatalogImportError extends DomainError {
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super(
      'CATALOG_IMPORT_INVALID',
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }
}
