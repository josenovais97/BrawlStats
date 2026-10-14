import { ES } from '@/i18n/es';
import { PT } from '@/i18n/pt';
import type { Locale } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { fill, makeT, type T, type Vars } from '@/lib/t-core';

export { fill, type T, type Vars };

/**
 * Sentence translation for server components, keyed by the English text.
 *
 * The English is the key, so a component reads as it always did --
 * `t('Live Brawl Stars data')` -- and a sentence nobody has translated yet
 * comes out in English rather than as a blank or a key. Placeholders are
 * `{name}`, filled from `vars`, so word order can differ per language.
 *
 * Server-side only by convention (nothing here is secret, but the
 * dictionaries are the whole site's text): client components use `useT`
 * from `components/i18n/use-t`, which carries a much smaller dictionary.
 */

const DICTS: Partial<Record<Locale, Record<string, string>>> = { es: ES, pt: PT };

export function translate(locale: Locale, text: string, vars?: Vars): string {
  return fill(DICTS[locale]?.[text] ?? text, vars);
}

export function getT(locale: Locale): T {
  return makeT(DICTS[locale] ?? null);
}

/** ["A", "B", "C"] -> "A, B and C", with the page's own word for "and". */
export function andList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${translate(requestLocale(), 'and')} ${items[items.length - 1]}`;
}
