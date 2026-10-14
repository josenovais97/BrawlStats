'use client';

import { useLocale } from '@/components/i18n/use-locale';
import { localePath } from '@/lib/i18n';

/** A link in the page's language, for client components (see `localePath`). */
export function useLp(): (path: string) => string {
  const locale = useLocale();
  return (path) => localePath(locale, path);
}
