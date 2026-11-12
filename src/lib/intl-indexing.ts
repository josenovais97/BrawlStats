/**
 * Whether the translated pages (/es /pt /tr /de /ru /fr) are offered to
 * search engines. Off since 2026-11-12 (AdSense rejected the site twice for
 * "low value content"; the second time, 2,040 of the 2,378 sitemap URLs were
 * translations Google had almost entirely declined to index: 47 impressions
 * and 0 clicks in 28 days, 1 of 24 sampled URLs indexed).
 *
 * Off means: every translated page answers with `X-Robots-Tag: noindex,
 * follow` (next.config.ts), no page names its translations in hreflang, and
 * the translations sitemap is left out of the sitemap index. The pages stay
 * live and linked for visitors (es/pt/ru/tr/de/fr had ~1,000 people a week
 * through the language switcher). Turn back on after AdSense approves, and
 * re-add the section to Search Console.
 *
 * No `@/` imports here: next.config.ts reads this file too.
 */
export const INTL_INDEXED = false;

export const INTL_PREFIXES = ['es', 'pt', 'tr', 'de', 'ru', 'fr'] as const;
