export type TaxonomyTier = 'A' | 'B';

export interface IngredientMetadata {
  readonly taxonomyClassId: number;
  readonly tier: TaxonomyTier;
  readonly allergens: readonly string[];
}
