import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TierListView } from '@/components/tier-list/tier-list-view';
import { isIntlLocale } from '@/lib/i18n';
import { bracketTierListMetadata, resolveBracket } from '@/lib/tier-list-route';
import { DEFAULT_TIER_WINDOW } from '@/lib/stats';

/* The Spanish and Portuguese tier lists: see `lib/i18n`. Same cache life as
   the English page, and runtime ISR (AGENTS.md trap 1). */
export const revalidate = 7200;

// No `dynamicParams = false` here, unlike the English page: with an empty
// list it would 404 every rank. An unknown rank 404s in `resolveBracket`.
export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ lang: string; bracket: string; scope: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, bracket, scope } = await params;
  if (!isIntlLocale(lang)) notFound();
  return bracketTierListMetadata(resolveBracket(bracket), scope, lang);
}

export default async function IntlBracketModeTierListPage({ params }: PageProps) {
  const { lang, bracket, scope } = await params;
  if (!isIntlLocale(lang)) notFound();
  return (
    <TierListView
      format="ranked"
      windowKey={DEFAULT_TIER_WINDOW}
      modeSlug={scope}
      bracket={resolveBracket(bracket)}
      locale={lang}
    />
  );
}
