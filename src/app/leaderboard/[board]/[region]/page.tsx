import type { Metadata } from 'next';

import { LeaderboardView } from '@/components/leaderboard/leaderboard-view';
import { leaderboardMetadata, resolveLeaderboardRoute } from '@/lib/leaderboard-route';

/** Mirrors the game API's own refresh: fresh enough, and now cached. */
export const revalidate = 120;

/* Runtime ISR. See the parent route. */
export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ board: string; region: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { board, region } = await params;
  return leaderboardMetadata(resolveLeaderboardRoute([board, region]));
}

/** One board in one region. 404s on the boards that have no region dimension. */
export default async function LeaderboardRegionPage({ params }: PageProps) {
  const { board, region } = await params;
  const route = resolveLeaderboardRoute([board, region]);
  return <LeaderboardView board={route.board} region={route.region} />;
}
