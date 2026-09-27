const COMBINING_MARKS = /[̀-ͯ]/g;
const DISALLOWED = /[^\p{L}\p{N}\s-]/gu;
const WHITESPACE_RUNS = /\s+/g;
const LOOSE_HYPHENS = /(?<![\p{L}\p{N}])-|-(?![\p{L}\p{N}])/gu;

function collapse(value: string): string {
  return value.replace(WHITESPACE_RUNS, ' ').trim();
}

// The offline evaluator in denly-mobile reproduces this exactly; change both or neither.
export function normalizeAlias(value: string): string {
  const folded = value
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/_/g, ' ')
    .replace(DISALLOWED, '');
  return collapse(collapse(folded).replace(LOOSE_HYPHENS, ''));
}
