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

/**
 * "{n} battles" with n = 3 -> "3 battles". An unknown placeholder stays.
 *
 * A translation can also carry plural forms for a count, keyed by the CLDR
 * category of `locale` (2026-11-04, for Russian, and Polish after it):
 * `{n|one:бой|few:боя|many:боёв|other:бои}` picks the form for the value of
 * `n`. Without a value for `n` it falls back to `other`, so a key that is
 * sometimes printed without a number still reads. English and the Romance
 * languages never need it: the code's own singular/plural choice is enough.
 */
export function fill(text: string, vars?: Vars, locale = 'en'): string {
  if (text.includes('|')) text = text.replace(/\{(\w+)\|([^{}]+)\}/g, (_, k: string, spec: string) => plural(spec, vars?.[k], locale));
  return vars
    ? text.replace(/\{(\w+)\}/g, (whole, k: string) => (k in vars ? String(vars[k] ?? '') : whole))
    : text;
}

const RULES = new Map<string, Intl.PluralRules>();

function plural(spec: string, value: string | number | null | undefined, locale: string): string {
  const forms = Object.fromEntries(spec.split('|').map((part) => {
    const at = part.indexOf(':');
    return [part.slice(0, at), part.slice(at + 1)];
  }));
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  if (value === undefined || value === null || !Number.isFinite(n)) return forms.other ?? '';
  let rules = RULES.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    RULES.set(locale, rules);
  }
  return forms[rules.select(n)] ?? forms.other ?? '';
}

/** A `T` over one dictionary (or none, for English), in that dictionary's language. */
export function makeT(dict: Record<string, string> | null, locale = 'en'): T {
  // A key may carry a context after `|` ("Brawl Stars|hero-1") when the same
  // English plays different parts; English shows the text before it.
  return ((text: unknown, vars?: Vars) =>
    typeof text === 'string' ? fill(dict?.[text] ?? text.replace(/\|[\w-]+$/, ''), vars, locale) : text) as T;
}
