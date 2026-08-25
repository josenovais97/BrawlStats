import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { isSupportedRegion, regionName } from '@/lib/regions';

/** The four rankings the page can show. */
export type LeaderboardBoard = 'players' | 'clubs' | 'ranked' | 'cosmetics';

/**
 * The URL scheme for the leaderboard, in one place.
 *
 * Board and region are path segments now, not `?type=` and `?region=`. The
 * reason is the same one that moved the tier-list window: reading
 * `searchParams` in a server component opts the route out of static rendering,
 * so a page that is identical for everyone looking at the same board was being
 * re-rendered — and re-fetched from the game API — on every single request.
 *
 *   /leaderboard                players, global
 *   /leaderboard/clubs          clubs, global
 *   /leaderboard/ranked         our own Ranked board (no region dimension)
 *   /leaderboard/players/us     players in one region
 *
 * The defaults stay out of the URL, so there is exactly one address per board.
 */

/** Every board, and whether the game API gives it a region dimension. */
const BOARDS: Record<LeaderboardBoard, { regional: boolean }> = {
  players: { regional: true },
  clubs: { regional: true },
  // Both are built from our own sampled pool, which is not split by region —
  // a region segment here would be a URL that changes nothing.
  ranked: { regional: false },
  cosmetics: { regional: false },
};

export const DEFAULT_BOARD: LeaderboardBoard = 'players';
export const DEFAULT_REGION = 'global';

/** Also used by the proxy, which validates a legacy `?type=` before using it. */
export function isLeaderboardBoard(value: string): value is LeaderboardBoard {
  return value in BOARDS;
}

/** Builds the canonical URL for a (board, region) combination. */
export function leaderboardHref(board: LeaderboardBoard, region = DEFAULT_REGION): string {
  const segments = ['leaderboard'];
  const regional = BOARDS[board].regional;
  const atDefaultRegion = !regional || region === DEFAULT_REGION;

  // The board segment is only omissible when the region is too — otherwise
  // there would be no slot for the region to sit in.
  if (board !== DEFAULT_BOARD || !atDefaultRegion) segments.push(board);
  if (!atDefaultRegion) segments.push(region);

  return `/${segments.join('/')}`;
}

export interface LeaderboardRoute {
  board: LeaderboardBoard;
  region: string;
}

/**
 * Turns the path segments after `/leaderboard` into a scope.
 *
 * Never returns for a URL that is not the canonical spelling of its own
 * content: an explicit default redirects to the shorter form, and a region on
 * a board that has no regions 404s rather than quietly ignoring it.
 */
export function resolveLeaderboardRoute(
  segments: (string | undefined)[],
): LeaderboardRoute {
  const [first, second] = segments.filter((s): s is string => Boolean(s));

  if (!first) return { board: DEFAULT_BOARD, region: DEFAULT_REGION };

  const board = first.toLowerCase();
  if (!isLeaderboardBoard(board)) notFound();

  if (!second) {
    if (board === DEFAULT_BOARD) permanentRedirect(leaderboardHref(board));
    return { board, region: DEFAULT_REGION };
  }

  const region = second.toLowerCase();
  if (!BOARDS[board].regional || !isSupportedRegion(region)) notFound();
  if (region === DEFAULT_REGION) permanentRedirect(leaderboardHref(board));

  return { board, region };
}

/**
 * Title, description and indexing directive for one leaderboard URL.
 *
 * Only the bare page is indexable. That is not new — every variant already
 * carried `canonical: '/leaderboard'` for the reason the old comment gave,
 * that region and board are "well over a hundred URLs" of the same page — this
 * just says it with a directive as well as a hint, now that each of those
 * variants is a real path a crawler could otherwise spend budget on.
 */
export function leaderboardMetadata({ board, region }: LeaderboardRoute): Metadata {
  const isDefault = board === DEFAULT_BOARD && region === DEFAULT_REGION;

  const title = isDefault
    ? 'Brawl Stars leaderboard'
    : board === 'ranked'
      ? 'Brawl Stars Ranked leaderboard'
      : board === 'cosmetics'
        ? 'Brawl Stars cosmetics leaderboard'
        : `Top Brawl Stars ${board} in ${regionName(region)}`;

  return {
    title,
    description: 'Top Brawl Stars players and clubs by trophies, filterable by region.',
    alternates: { canonical: '/leaderboard' },
    ...(isDefault ? {} : { robots: { index: false, follow: true } }),
  };
}
