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
 * The four boards are indexable; the region variants are not.
 *
 * That split is the whole point. "brawl stars club leaderboard" and "brawl
 * stars ranked leaderboard" are distinct searches with distinct answers, and
 * the boards are not the same page with a filter applied — two of them are the
 * game's own rankings and two are built from our own sample. The Ranked board
 * in particular is not published anywhere else: the game API has no Ranked
 * leaderboard endpoint, so that page exists only because this project records
 * elo per sample.
 *
 * The regions are the opposite case. There are well over a hundred, every one
 * of them the same board over a smaller population, and nobody searches for
 * them by name. They stay `noindex, follow` and point their canonical at the
 * board they narrow.
 */
const BOARD_COPY: Record<LeaderboardBoard, { title: string; description: string }> = {
  players: {
    title: 'Brawl Stars leaderboard',
    description:
      'The top Brawl Stars players by trophies, from the game API\'s own global ranking, with per-region boards.',
  },
  clubs: {
    title: 'Brawl Stars club leaderboard',
    description:
      'The top Brawl Stars clubs by combined member trophies, from the game API\'s own global ranking, with per-region boards.',
  },
  ranked: {
    title: 'Brawl Stars Ranked leaderboard',
    description:
      'The highest Ranked elo among the players BrawlZone samples. The game API publishes no Ranked leaderboard, so this board is built from our own daily samples rather than mirrored from Supercell.',
  },
  cosmetics: {
    title: 'Brawl Stars skin and icon popularity',
    description:
      'Which skins and profile icons Brawl Stars players actually equip, counted from BrawlZone\'s own daily samples of the player pool.',
  },
};

export function leaderboardMetadata({ board, region }: LeaderboardRoute): Metadata {
  const copy = BOARD_COPY[board];
  const atDefaultRegion = region === DEFAULT_REGION;

  if (atDefaultRegion) {
    return {
      title: copy.title,
      description: copy.description,
      alternates: { canonical: leaderboardHref(board) },
    };
  }

  return {
    title: `${copy.title} — ${regionName(region)}`,
    description: copy.description,
    // The board it narrows, not itself: one of these per supported region is
    // over a hundred URLs of the same page.
    alternates: { canonical: leaderboardHref(board) },
    robots: { index: false, follow: true },
  };
}
