import type { Metadata } from 'next';

import { languageAlternates, localePath, type Locale } from '@/lib/i18n';
import { getT } from '@/lib/t';

/**
 * An English page's metadata for its Spanish or Portuguese copy: title and
 * descriptions through the dictionary, and the canonical moved to this
 * language with the other two as alternates.
 *
 * Titles built from data in `generateMetadata` arrive already translated --
 * they run with the request's language set -- and pass through `t` unchanged.
 */
export function translateMetadata(md: Metadata, locale: Locale, enPath?: string): Metadata {
  const t = getT(locale);
  const title = md.title;
  const out: Metadata = { ...md };
  if (typeof title === 'string') out.title = t(title);
  else if (title && typeof title === 'object' && 'absolute' in title && title.absolute) {
    out.title = { ...title, absolute: t(title.absolute) };
  }
  if (md.description) out.description = t(md.description);
  if (md.openGraph) {
    const og = { ...md.openGraph };
    if (typeof og.title === 'string') og.title = t(og.title);
    if (og.description) og.description = t(og.description);
    out.openGraph = og;
  }
  // The English page's own canonical, or its address when it declares none.
  const declared = md.alternates?.canonical;
  const canonical = typeof declared === 'string' ? declared : enPath;
  if (typeof canonical === 'string' && canonical.startsWith('/')) {
    out.alternates = { ...md.alternates, canonical: localePath(locale, canonical), languages: languageAlternates(canonical) };
  }
  return out;
}

/** A route pattern filled from its params: `/maps/[mode]` -> `/maps/gem-grab`. */
export function routePath(pattern: string, params: Record<string, string | string[] | undefined>): string {
  const path = pattern.replace(/\/\[\[?\.{0,3}(\w+)\]?\]/g, (_, name: string) => {
    const v = params[name];
    if (v === undefined) return '';
    return `/${Array.isArray(v) ? v.join('/') : v}`;
  });
  return path || '/';
}
