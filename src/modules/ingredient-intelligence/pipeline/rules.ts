import type {
  Rule,
  RuleAction,
  RulePredicate,
} from '../models/rules-bundle.model.js';
import type {
  ConfidenceBand,
  StructuredIngredient,
} from '../models/structured-ingredient-data.model.js';
import type { RuleDraft } from './pipeline-types.js';

export interface RulesResult {
  readonly ingredients: readonly StructuredIngredient[];
  readonly flags: readonly string[];
}

function stepDownBand(band: ConfidenceBand): ConfidenceBand {
  if (band === 'high') {
    return 'medium';
  }
  return 'low';
}

function matchPredicate(
  predicate: RulePredicate,
  drafts: readonly RuleDraft[],
): readonly RuleDraft[] {
  switch (predicate.kind) {
    case 'anySlug':
      return drafts.filter((draft) => predicate.values.includes(draft.slug));
    case 'anyCategory':
      return drafts.filter((draft) =>
        predicate.values.includes(draft.category),
      );
    case 'anyAllergen':
      return drafts.filter((draft) =>
        draft.metadata.allergens.some((allergen) =>
          predicate.values.includes(allergen),
        ),
      );
    case 'allSlugs': {
      const slugs = new Set(drafts.map((draft) => draft.slug));
      const everyValuePresent = predicate.values.every((slug) =>
        slugs.has(slug),
      );
      if (!everyValuePresent) {
        return [];
      }
      return drafts.filter((draft) => predicate.values.includes(draft.slug));
    }
  }
}

function applyAction(
  action: RuleAction,
  matched: readonly RuleDraft[],
  flags: Set<string>,
): void {
  if (action.kind === 'addFlag') {
    flags.add(action.flag);
    return;
  }
  for (const draft of matched) {
    draft.confidenceBand = stepDownBand(draft.confidenceBand);
  }
}

export function applyRules(
  ingredients: readonly StructuredIngredient[],
  rules: readonly Rule[],
): RulesResult {
  const drafts: RuleDraft[] = ingredients.map((ingredient) => ({
    ...ingredient,
    ruleHits: [...ingredient.ruleHits],
  }));
  const flags = new Set<string>();

  for (const rule of rules) {
    const matched = matchPredicate(rule.when, drafts);
    if (matched.length === 0) {
      continue;
    }
    for (const draft of matched) {
      if (!draft.ruleHits.includes(rule.id)) {
        draft.ruleHits.push(rule.id);
      }
    }
    for (const action of rule.then) {
      applyAction(action, matched, flags);
    }
  }

  return { ingredients: drafts, flags: [...flags] };
}
