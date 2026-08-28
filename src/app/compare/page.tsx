import type { Metadata } from 'next';

import { CompareTool } from '@/components/compare/compare-tool';

export const metadata: Metadata = {
  title: 'Compare Brawl Stars players and brawlers side by side',
  description:
    'Put two Brawl Stars players or two brawlers side by side: trophies, Ranked, skill score, account completion, win rates and head-to-head records.',
  alternates: { canonical: '/compare' },
};

export const revalidate = 3600;

/**
 * The bare tool, with nothing to compare yet.
 *
 * A specific pairing lives at `/compare/players/[a]/[b]` rather than at
 * `?player1=&player2=` here, and the split is the point: a pairing has to be
 * rendered against the live API for whoever asked for it, while this page is
 * the same for everyone and is the one search engines and new visitors land
 * on. Reading the tags as search parameters made both of those the same
 * uncacheable route, so the common case paid the cost of the rare one.
 */
export default function CompareIndexPage() {
  return <CompareTool />;
}
