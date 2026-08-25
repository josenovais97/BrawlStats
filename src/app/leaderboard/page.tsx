import type { Metadata } from 'next';

import { LeaderboardView } from '@/components/leaderboard/leaderboard-view';
import { leaderboardMetadata, resolveLeaderboardRoute } from '@/lib/leaderboard-route';

/** Mirrors the game API's own refresh: fresh enough, and now cached. */
export const revalidate = 120;

export function generateMetadata(): Metadata {
  return leaderboardMetadata(resolveLeaderboardRoute([]));
}

export default function LeaderboardPage() {
  const route = resolveLeaderboardRoute([]);
  return <LeaderboardView board={route.board} region={route.region} />;
}
