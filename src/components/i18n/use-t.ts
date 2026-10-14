'use client';

import { useLocale } from '@/components/i18n/use-locale';
import { CLIENT_ES, CLIENT_PT } from '@/i18n/client';
import { makeT, type T } from '@/lib/t-core';

/** `t` for client components, in the language of the page's address. */
export function useT(): T {
  const locale = useLocale();
  return makeT(locale === 'es' ? CLIENT_ES : locale === 'pt' ? CLIENT_PT : null);
}
