/** Ordinal comparison by UTF-16 code unit — never `localeCompare`, so ordering matches offline. */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
