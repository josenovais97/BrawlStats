import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TierListView } from '@/components/tier-list/tier-list-view';
import { isIntlLocale } from '@/lib/i18n';
import { resolveTierRoute, tierListMetadata } from '@/lib/tier-list-route';

/* The Spanish and Portuguese tier lists: see `lib/i18n`. Same cache life as
   the English page, and runtime ISR (AGENTS.md trap 1). */
export const revalidate = 7200;

export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ lang: string; scope: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, scope } = await params;
  if (!isIntlLocale(lang)) notFound();
  return tierListMetadata('trophy', resolveTierRoute('trophy', [scope], lang), lang);
}

export default async function IntlTrophyScopedTierListPage({ params }: PageProps) {
  const { lang, scope } = await params;
  if (!isIntlLocale(lang)) notFound();
  const route = resolveTierRoute('trophy', [scope], lang);
  return <TierListView format="trophy" windowKey={route.windowKey} modeSlug={route.modeSlug} locale={lang} />;
}
