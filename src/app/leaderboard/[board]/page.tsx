import type { Metadata } from "next";

import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import {
  leaderboardMetadata,
  resolveLeaderboardRoute,
} from "@/lib/leaderboard-route";

/**
 * Fifteen minutes, not two.
 *
 * The board mirrors the game API's own ranking, which does not move on a
 * two-minute grain — but a two-minute window meant a path could regenerate up
 * to 720 times a day, and every regeneration is an ISR write billed in 8 KB
 * units. With traffic thinner than the window, nearly every read triggered a
 * write: the ratio Vercel calls write utilisation sitting at about 1, which is
 * the definition of a cache paying for itself twice.
 *
 * It costs a visitor at most fifteen minutes of staleness on a leaderboard
 * whose top hundred rarely reorder inside an hour.
 */
export const revalidate = 900;

/* Runtime ISR. Without an empty `generateStaticParams` a dynamic segment is
   re-rendered per request however short its `revalidate` is. */
export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ board: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { board } = await params;
  return leaderboardMetadata(resolveLeaderboardRoute([board]));
}

/** One board at the default region. See `resolveLeaderboardRoute`. */
export default async function LeaderboardBoardPage({ params }: PageProps) {
  const { board } = await params;
  const route = resolveLeaderboardRoute([board]);
  return <LeaderboardView board={route.board} region={route.region} />;
}
