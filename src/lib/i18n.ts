/**
 * The site in Spanish and Portuguese, for the pages that have been translated.
 *
 * Added 2026-10-13. Brazil and Latin America are among the biggest Brawl Stars
 * audiences and search in their own language ("mejores brawlers", "melhores
 * brawlers", "como counterar"), which an English-only site never ranks for.
 * Not the whole site: the tier lists and the counters pages, the searches
 * worth most, each under `/es` and `/pt` with the English page untouched at
 * its own address. Everything else links back to English.
 *
 * Game words -- modes, maps, rank names -- are the game's own, from its
 * localisation files (`lib/game-l10n`), so a player reads "Atrapagemas" here
 * because that is what their game calls it. Spanish uses the Latin American
 * file: far more of the Spanish-speaking players are there than in Spain, and
 * the two differ in a handful of names.
 *
 * Client-safe: no server imports, so client components can format with it.
 */

export type Locale = 'en' | 'es' | 'pt';
export const INTL_LOCALES = ['es', 'pt'] as const;
export type IntlLocale = (typeof INTL_LOCALES)[number];

export function isIntlLocale(value: string | null | undefined): value is IntlLocale {
  return value === 'es' || value === 'pt';
}

/** For `<html lang>`-style attributes and hreflang. */
export const HTML_LANG: Record<Locale, string> = { en: 'en', es: 'es', pt: 'pt-BR' };

export const LOCALE_NAME: Record<Locale, string> = { en: 'English', es: 'Español', pt: 'Português' };

/**
 * Number formatting per locale. Spanish as Latin America writes it (55.1,
 * 12,345 -- Mexico's convention, the largest audience), Portuguese as Brazil
 * does (55,1 and 12.345).
 */
const NUMBER_LOCALE: Record<Locale, string> = { en: 'en-US', es: 'es-419', pt: 'pt-BR' };
const DATE_LOCALE: Record<Locale, string> = { en: 'en-GB', es: 'es-419', pt: 'pt-BR' };

/**
 * The sections that exist in Spanish and Portuguese, as path patterns. Grows
 * as each part of the site is translated; a link to anything not listed goes
 * to the English page rather than a 404.
 */
const TRANSLATED: RegExp[] = [
  // Everything a person reads, since 2026-10-14. Not: the API, files, the
  // Bubble's in-app panel (it has its own 22 languages), the TikTok slides.
  /^\/(?!api\/|bubble\/panel|downloads\/|daily\/[^/]+\/(?:[a-z]+\/)?(?:slides|slide)|.*\.(?:xml|txt|json|png|jpg|webmanifest)$)/,
];

/** Whether a path has a translated version. */
export function isTranslatedPath(path: string): boolean {
  const bare = path.split(/[?#]/)[0];
  return TRANSLATED.some((re) => re.test(bare));
}

/** The locale a path is in: its `/es` or `/pt` prefix, English otherwise. */
export function localeOfPath(pathname: string | null | undefined): Locale {
  const first = pathname?.split('/')[1];
  return isIntlLocale(first) ? first : 'en';
}

/** A path with its `/es` or `/pt` prefix removed: the English page's path. */
export function stripLocale(pathname: string): string {
  const first = pathname.split('/')[1];
  if (!isIntlLocale(first)) return pathname;
  return pathname.slice(first.length + 1) || '/';
}

/**
 * The path in a locale: prefixed when a translation exists, the English page
 * otherwise -- so a link from a Spanish page to a page that is only in English
 * goes to the English page rather than a 404.
 */
export function localePath(locale: Locale, path: string): string {
  // Already in a language (a link built by a caller that localised it).
  if (isIntlLocale(path.split('/')[1])) return path;
  if (locale === 'en' || !isTranslatedPath(path)) return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

/**
 * hreflang for a translated page, keyed the way Next's `alternates.languages`
 * wants it. The English page is the x-default: it is the one a reader in any
 * other language should land on.
 */
export function languageAlternates(path: string): Record<string, string> {
  const under = (l: string) => (path === '/' ? `/${l}` : `/${l}${path}`);
  return {
    en: path,
    es: under('es'),
    'pt-BR': under('pt'),
    'x-default': path,
  };
}

export function fmtNumber(n: number | null | undefined, locale: Locale): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '–';
  return n.toLocaleString(NUMBER_LOCALE[locale]);
}

/** 0.5432 -> "54.3%" / "54,3%". One decimal, like `formatPercent`. */
export function fmtPercent(value: number | null | undefined, locale: Locale): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  const n = (value * 100).toLocaleString(NUMBER_LOCALE[locale], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${n}%`;
}

/** One decimal, signless, in the locale's separator: 7.4 / 7,4. */
export function fmtDecimal(value: number, locale: Locale): string {
  return value.toLocaleString(NUMBER_LOCALE[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** "13 October 2026" / "13 de octubre de 2026", UTC like `formatDate`. */
export function fmtDate(value: string | Date | null | undefined, locale: Locale): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(DATE_LOCALE[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "October 2026" / "octubre de 2026", for titles, like `currentMonth`. */
export function monthYear(locale: Locale): string {
  return new Date().toLocaleDateString(DATE_LOCALE[locale], { month: 'long', year: 'numeric' });
}

/** The Ranked brackets' labels. The league words are the game's own. */
export const RANK_LABEL: Record<Locale, Record<string, string>> = {
  en: { diamond: 'Diamond and below', mythic: 'Mythic', legendary: 'Legendary', masters: 'Masters to Pro' },
  es: { diamond: 'Diamante o menos', mythic: 'Mítico', legendary: 'Legendario', masters: 'Maestros a Pro' },
  pt: { diamond: 'Diamante ou abaixo', mythic: 'Mítico', legendary: 'Lendário', masters: 'Mestres a Pro' },
};

export function rankLabel(bracket: { slug: string; label: string }, locale: Locale): string {
  return RANK_LABEL[locale][bracket.slug] ?? bracket.label;
}

/** "since yesterday" and friends, for the movement badges. */
export function spanText(from: string, to: string, locale: Locale): string {
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  const words = {
    en: ['since the last snapshot', 'since yesterday', 'in the last week', (d: number) => `in the last ${d} days`],
    es: ['desde la última medición', 'desde ayer', 'en la última semana', (d: number) => `en los últimos ${d} días`],
    pt: ['desde a última medição', 'desde ontem', 'na última semana', (d: number) => `nos últimos ${d} dias`],
  } as const;
  const [none, one, week, many] = words[locale];
  if (!Number.isFinite(days) || days <= 0) return none;
  if (days === 1) return one;
  if (days === 7) return week;
  return many(days);
}
