import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CountersView, countersMetadata } from '@/components/brawlers/counters-view';
import { isIntlLocale } from '@/lib/i18n';

/* How to counter a brawler, in Spanish or Portuguese: see `lib/i18n`. */
export const revalidate = 7200;

/* Runtime ISR — see AGENTS.md trap 1. */
export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ lang: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isIntlLocale(lang)) notFound();
  return countersMetadata(slug, lang);
}

export default async function IntlCountersPage({ params }: PageProps) {
  const { lang, slug } = await params;
  if (!isIntlLocale(lang)) notFound();
  return <CountersView slug={slug} locale={lang} />;
}
