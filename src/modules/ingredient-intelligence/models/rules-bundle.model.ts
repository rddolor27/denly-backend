export type RulePredicate =
  | { readonly kind: 'anySlug'; readonly values: readonly string[] }
  | { readonly kind: 'allSlugs'; readonly values: readonly string[] }
  | { readonly kind: 'anyCategory'; readonly values: readonly string[] }
  | { readonly kind: 'anyAllergen'; readonly values: readonly string[] };

export type RuleAction =
  | { readonly kind: 'addFlag'; readonly flag: string }
  | { readonly kind: 'lowerBand' };

export interface Rule {
  readonly id: string;
  readonly reason: string;
  readonly when: RulePredicate;
  readonly then: readonly RuleAction[];
}

export interface ConfidenceBands {
  readonly high: number;
  readonly medium: number;
}

export interface RulesBundle {
  readonly rulesVersion: string;
  readonly confidenceFloor: number;
  readonly classFloors: Readonly<Record<string, number>>;
  readonly bands: ConfidenceBands;
  readonly rules: readonly Rule[];
}
