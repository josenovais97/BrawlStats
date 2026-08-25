import type { Metadata } from 'next';

import { LeaderboardView } from '@/components/leaderboard/leaderboard-view';
import { leaderboardMetadata, resolveLeaderboardRoute } from '@/lib/leaderboard-route';

/** Mirrors the game API's own refresh: fresh enough, and now cached. */
export const revalidate = 120;

/* Runtime ISR. Without an empty `generateStaticParams` a dynamic segment is
   re-rendered per request however short its `revalidate` is. */
export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ board: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { board } = await params;
  return leaderboardMetadata(resolveLeaderboardRoute([board]));
}

/** One board at the default region. See `resolveLeaderboardRoute`. */
export default async function LeaderboardBoardPage({ params }: PageProps) {
  const { board } = await params;
  const route = resolveLeaderboardRoute([board]);
  return <LeaderboardView board={route.board} region={route.region} />;
}
