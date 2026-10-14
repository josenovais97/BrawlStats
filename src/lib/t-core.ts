/** The part of `lib/t` the browser needs too: no dictionaries. */

/** Placeholder values. Empty ones render as nothing, as they would in JSX. */
export type Vars = Record<string, string | number | null | undefined>;

/**
 * Translate a sentence. Anything that is not a string -- a heading passed in
 * as an element, a missing value -- comes back untouched, which is what lets
 * `t(title)` be used on props that are usually but not always text.
 */
export interface T {
  (text: string, vars?: Vars): string;
  <N>(text: N): N;
}

/** "{n} battles" with n = 3 -> "3 battles". An unknown placeholder stays. */
export function fill(text: string, vars?: Vars): string {
  return vars
    ? text.replace(/\{(\w+)\}/g, (whole, k: string) => (k in vars ? String(vars[k] ?? '') : whole))
    : text;
}

/** A `T` over one dictionary (or none, for English). */
export function makeT(dict: Record<string, string> | null): T {
  // A key may carry a context after `|` ("Brawl Stars|hero-1") when the same
  // English plays different parts; English shows the text before it.
  return ((text: unknown, vars?: Vars) =>
    typeof text === 'string' ? fill(dict?.[text] ?? text.replace(/\|[\w-]+$/, ''), vars) : text) as T;
}
