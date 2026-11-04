import { use } from 'react';

import { CLIENT_LOADERS, type ClientDict } from '@/i18n/client';
import type { IntlLocale, Locale } from '@/lib/i18n';

/**
 * The client dictionary for a language, loaded on first use and kept.
 *
 * Call it while rendering (it is `use`, so it may suspend). The first call for
 * a language starts loading that language's chunk; until it arrives the
 * component suspends, which during hydration means React keeps the server's
 * HTML on screen instead of rendering English over it. Every later call reads
 * the settled promise synchronously. English has no dictionary and never waits.
 *
 * Its two callers, `useT` and `getUT`, both run only while a component
 * renders, which is all `use` asks; the lint rule wants a hook-shaped name,
 * and `getUT` is called as a default prop value, where a hook name would lie.
 */
const loading = new Map<IntlLocale, Promise<ClientDict>>();

export function clientDict(locale: Locale): ClientDict | null {
  if (locale === 'en') return null;
  let pending = loading.get(locale);
  if (!pending) {
    pending = CLIENT_LOADERS[locale]();
    loading.set(locale, pending);
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks -- see above: only ever called during render
  return use(pending);
}
