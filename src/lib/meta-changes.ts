import type { MetaMover, Tier } from '@/types/stats';

/**
 * Movement between two tier-list snapshots, as data.
 *
 * Extracted from the component that first needed it, because the Discord post
 * needs exactly the same answer and a CLI script cannot import a file that
 * pulls in React. Everything here is pure: no rendering, no `server-only`, so
 * it runs in a script and in a server component alike.
 */

/** One brawler's movement, in the three forms anything shows it. */
export interface BrawlerChange {
  scoreDelta: number;
  /** Positive is upward: places gained since the earlier snapshot. */
  rankDelta: number;
  tierBefore: Tier;
  tierNow: Tier;
  crossedTier: boolean;
}

/**
 * Below this, a "move" is the third decimal place of a noisy score.
 *
 * A crossed tier boundary is always notable regardless, because that is a
 * visible change even when the score barely moved.
 */
const MIN_SCORE_MOVE = 0.15;

/** S is the top, so a *lower* index is a better tier. */
export function tierRank(tier: Tier): number {
  return ['S', 'A', 'B', 'C', 'D'].indexOf(tier);
}

/**
 * Ranks are positions among the brawlers that clear the sample floor on *both*
 * dates, which is the same population the tier list rates. It is not a rank
 * out of 107, and no copy built on this should claim it is — "3 places" is a
 * distance, and the distance is honest.
 */
export function buildChangeIndex(movers: MetaMover[]): Map<number, BrawlerChange> {
  const index = new Map<number, BrawlerChange>();
  if (movers.length === 0) return index;

  const rankNow = new Map<number, number>();
  const rankBefore = new Map<number, number>();

  [...movers]
    .sort((a, b) => b.metaScoreNow - a.metaScoreNow)
    .forEach((m, i) => rankNow.set(m.brawlerId, i + 1));
  [...movers]
    .sort((a, b) => b.metaScoreBefore - a.metaScoreBefore)
    .forEach((m, i) => rankBefore.set(m.brawlerId, i + 1));

  for (const mover of movers) {
    index.set(mover.brawlerId, {
      scoreDelta: mover.metaScoreDelta,
      rankDelta: (rankBefore.get(mover.brawlerId) ?? 0) - (rankNow.get(mover.brawlerId) ?? 0),
      tierBefore: mover.tierBefore,
      tierNow: mover.tierNow,
      crossedTier: mover.tierBefore !== mover.tierNow,
    });
  }

  return index;
}

/** Whether a change is worth the ink. */
export function isNotable(change: BrawlerChange): boolean {
  return change.crossedTier || Math.abs(change.scoreDelta) >= MIN_SCORE_MOVE;
}

/**
 * How long the comparison actually spans.
 *
 * Written from the snapshot dates rather than hard-coded, because the lookback
 * is a *request*: `getMetaMovers` falls back to the oldest comparable snapshot
 * when the dataset is too young, so a caller asking for seven days can
 * legitimately be showing two. Printing "since yesterday" over a week-old
 * comparison would be the kind of small lie that makes every other number
 * worth doubting.
 */
export function spanLabel(from: string, to: string): string {
  const days = Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
  if (!Number.isFinite(days) || days <= 0) return 'since the last snapshot';
  if (days === 1) return 'since yesterday';
  if (days === 7) return 'in the last week';
  return `in the last ${days} days`;
}
