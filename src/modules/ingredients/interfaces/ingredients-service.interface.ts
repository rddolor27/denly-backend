import type { IngredientModel } from '../models/ingredient.model.js';

export interface IngredientListQuery {
  readonly q: string | null;
  readonly category: string | null;
  readonly limit: number;
  readonly offset: number;
}

export interface IngredientPage {
  readonly items: readonly IngredientModel[];
  readonly total: number;
}

export interface IIngredientsService {
  list(query: IngredientListQuery): Promise<IngredientPage>;
  /** With aliases loaded; throws IngredientNotFoundError. */
  findBySlug(slug: string): Promise<IngredientModel>;
  /** One batched lookup through `model_class` aliases, keyed by the className given; unmapped names are absent. */
  resolveModelClasses(
    classNames: readonly string[],
  ): Promise<ReadonlyMap<string, IngredientModel>>;
}
