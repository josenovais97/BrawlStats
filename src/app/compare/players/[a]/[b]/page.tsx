import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CompareTool } from '@/components/compare/compare-tool';
import { loadComparison } from '@/lib/player-compare';
import { displayTag, normalizeTag } from '@/lib/tags';

interface PageProps {
  params: Promise<{ a: string; b: string }>;
}

/**
 * One player pairing.
 *
 * Dynamic on purpose, and the only route under `/compare` that is. The people
 * looking at a comparison have usually just played, the same argument that
 * keeps `/player/[tag]` uncached — serving them an hour-old answer to save
 * bytes is the wrong trade. What matters is that the cost stops here instead
 * of falling on `/compare` itself, which is static and is what gets crawled.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { a, b } = await params;

  return {
    title: `${displayTag(a)} vs ${displayTag(b)} — Brawl Stars comparison`,
    description:
      'Two Brawl Stars players side by side: trophies, Ranked, skill score, account completion and roster overlap.',
    // The bare tool page, not this one: a specific pairing is one of unbounded
    // many and should consolidate onto the page that explains the tool.
    alternates: { canonical: '/compare' },
    // There is one such URL per pair of accounts in existence.
    robots: { index: false, follow: true },
  };
}

export default async function ComparePlayersPage({ params }: PageProps) {
  const { a, b } = await params;
  const tagA = normalizeTag(a);
  const tagB = normalizeTag(b);

  // A pairing needs two different players; anything else is not a comparison.
  if (!tagA || !tagB || tagA === tagB) notFound();

  const comparison = await loadComparison(tagA, tagB);

  return <CompareTool comparison={comparison} tagA={tagA} tagB={tagB} />;
}
