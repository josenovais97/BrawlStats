import type { Metadata } from 'next';

import { CompareTool } from '@/components/compare/compare-tool';
import { currentMonth } from '@/lib/site';

/* A function, not an object, so the month is not frozen at module load —
   see `currentMonth`. */
export function generateMetadata(): Metadata {
  return {
    title: `Compare Brawl Stars players and brawlers (${currentMonth()})`,
    description: `Put two Brawl Stars players or two brawlers side by side, ${currentMonth()}: trophies, Ranked, skill score, account completion, win rates and head-to-head records.`,
    alternates: { canonical: '/compare' },
  };
}

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
