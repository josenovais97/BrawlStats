import type { IntlLocale } from '@/lib/i18n';

/**
 * The text of client components, which ships to the browser -- so it is kept
 * apart from the server dictionaries (`i18n/es.ts`, ...), which hold the whole
 * site. Keyed by the English sentence, like those.
 *
 * One file per language, each loaded as its own chunk (2026-11-04): with every
 * language in one module, every page downloaded all of them -- 48 KB gzipped at
 * four languages, and an English reader paid for all four. Now a page fetches
 * only its own, and English fetches nothing. Read through `lib/client-dict`.
 */
export type ClientDict = Record<string, string>;

export const CLIENT_LOADERS: Record<IntlLocale, () => Promise<ClientDict>> = {
  es: () => import('./es').then((m) => m.CLIENT_ES),
  pt: () => import('./pt').then((m) => m.CLIENT_PT),
  tr: () => import('./tr').then((m) => m.CLIENT_TR),
  de: () => import('./de').then((m) => m.CLIENT_DE),
  ru: () => import('./ru').then((m) => m.CLIENT_RU),
};
