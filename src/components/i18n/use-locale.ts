'use client';

import { usePathname } from 'next/navigation';

import { localeOfPath, type Locale } from '@/lib/i18n';

/**
 * The page's language, from its address. For the parts of the layout that
 * every page shares (header, footer, the 404), which the root layout renders
 * without knowing the route.
 */
export function useLocale(): Locale {
  return localeOfPath(usePathname());
}
