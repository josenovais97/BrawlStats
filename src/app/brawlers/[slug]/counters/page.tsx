import type { Metadata } from 'next';

import { CountersView, countersMetadata } from '@/components/brawlers/counters-view';

/**
 * How to counter one brawler. The page itself is `CountersView`, shared with
 * the Spanish and Portuguese copies under `/[lang]`.
 *
 * Runtime ISR like the brawler page: nothing built ahead, each page rendered
 * on first visit and kept for the read cache's two hours.
 */

export const revalidate = 7200;

/* Runtime ISR — see AGENTS.md trap 1. */
export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return countersMetadata(slug, 'en');
}

export default async function CountersPage({ params }: PageProps) {
  const { slug } = await params;
  return <CountersView slug={slug} locale="en" />;
}
