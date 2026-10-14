import { cache } from 'react';

import { localeOfPath, type Locale } from '@/lib/i18n';

/**
 * The language of the page being rendered, for server components.
 *
 * Set once by each `/[lang]` route before it renders the shared page, and read
 * by anything below it -- the way next-intl's `setRequestLocale` works. React's
 * `cache` gives one store per server render, so two pages rendering at once
 * never see each other's language. Anything that never set it is English,
 * which is every original page.
 *
 * In the browser there is no request: the answer is read from the address,
 * which is what the server rendered that page in, so client components and
 * `lib/format` agree with the HTML they hydrate.
 */
const store = cache((): { locale: Locale } => ({ locale: 'en' }));

export function setRequestLocale(locale: Locale): void {
  store().locale = locale;
}

export function requestLocale(): Locale {
  if (typeof window !== 'undefined') return localeOfPath(window.location.pathname);
  try {
    return store().locale;
  } catch {
    return 'en';
  }
}
