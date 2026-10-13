import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { HTML_LANG, isIntlLocale } from '@/lib/i18n';

/**
 * The `/es` and `/pt` pages (see `lib/i18n`).
 *
 * The root layout's `<html lang="en">` stays: setting it per language would
 * mean a second root layout and moving every route under a group. The page's
 * own language is declared on this wrapper instead, which is what screen
 * readers and the browser's translate prompt read; search engines go by the
 * hreflang links and the text itself. Anything other than the two languages
 * is a 404, so this segment never swallows a real first-level URL.
 */
export default async function IntlLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isIntlLocale(lang)) notFound();
  return <div lang={HTML_LANG[lang]}>{children}</div>;
}
