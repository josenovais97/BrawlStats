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

export function generateMetadata(): Metadata {
  return leaderboardMetadata(resolveLeaderboardRoute([]));
}

export default function LeaderboardPage() {
  const route = resolveLeaderboardRoute([]);
  return <LeaderboardView board={route.board} region={route.region} />;
}
