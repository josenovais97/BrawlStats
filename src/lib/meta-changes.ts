import { TIER_ORDER } from '@/lib/tiers';
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

/**
 * S is the top, so a *lower* index is a better tier.
 *
 * Reads TIER_ORDER rather than listing the letters again. The second copy was
 * already wrong the moment E and F were added, and a tier missing from this
 * list silently ranks -1, which is better than every real tier.
 */
export function tierRank(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
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

/** Whether a change is worth the ink, judged on its own snapshot pair. */
export function isNotable(change: BrawlerChange): boolean {
  return change.crossedTier || Math.abs(change.scoreDelta) >= MIN_SCORE_MOVE;
}

/**
 * The same question, asked against the tier a page has actually placed the
 * brawler in.
 *
 * `change.tierNow` comes from `getMetaMovers`, which assigns a tier from the
 * latest stored snapshot. A tier list assigns its own from `scoreBrawlers`
 * over whichever window the reader picked. Those are two computations over two
 * different windows, and they disagree often: Brock sat in the S row carrying
 * a red "A tier" badge, because the snapshot pair said A while the page's own
 * 7-day scoring said S.
 *
 * So anything rendered beside a tier chip has to judge the crossing against
 * that chip, not against the snapshot's opinion of where the brawler is.
 */
export function isNotableInTier(change: BrawlerChange, currentTier: Tier): boolean {
  return change.tierBefore !== currentTier || Math.abs(change.scoreDelta) >= MIN_SCORE_MOVE;
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

/**
 * The Bubble panel's trend arrows (2026-11-06): the three biggest risers and
 * fallers of the week, and only moves that crossed a tier by a full point of
 * meta score. Just after the November update 88 of 107 brawlers passed
 * `isNotable`; arrows on all of them would be noise, so this is capped.
 */
export function panelTrend(movers: MetaMover[], perSide = 3, minDelta = 1): Record<number, 1 | -1> {
  const big = movers.filter((m) => m.tierBefore !== m.tierNow && Math.abs(m.metaScoreDelta) >= minDelta);
  const out: Record<number, 1 | -1> = {};
  for (const m of [...big].filter((x) => x.metaScoreDelta > 0).sort((a, b) => b.metaScoreDelta - a.metaScoreDelta).slice(0, perSide)) out[m.brawlerId] = 1;
  for (const m of [...big].filter((x) => x.metaScoreDelta < 0).sort((a, b) => a.metaScoreDelta - b.metaScoreDelta).slice(0, perSide)) out[m.brawlerId] = -1;
  return out;
}

/** One brawler's games over a span: the two halves of a week-on-week arrow. */
export interface SpanGames {
  brawlerId: number;
  wins: number;
  games: number;
}

/**
 * The arrows on a rank's tier list (2026-11-25, owner: "arrows to show players
 * that a brawler is increasing or decreasing"): 1 for a brawler whose win rate
 * rose against the week before, -1 for one that fell.
 *
 * A point at least, and a move the sample can tell from luck (2.5 standard
 * errors, 1,000 games on each side): measured on 2026-11-25 that is 15 of 104
 * brawlers in Mythic and 25 of 107 in Legendary. Fewer games than that draw no
 * arrow rather than a coin toss.
 */
export function weekTrend(now: SpanGames[], before: SpanGames[], minGames = 1000, minMove = 0.01, sure = 2.5): Record<number, 1 | -1> {
  const prev = new Map(before.map((b) => [b.brawlerId, b]));
  const out: Record<number, 1 | -1> = {};
  for (const n of now) {
    const p = prev.get(n.brawlerId);
    if (!p || n.games < minGames || p.games < minGames) continue;
    const move = n.wins / n.games - p.wins / p.games;
    const error = Math.sqrt(0.25 / n.games + 0.25 / p.games);
    if (Math.abs(move) >= minMove && Math.abs(move) >= sure * error) out[n.brawlerId] = move > 0 ? 1 : -1;
  }
  return out;
}
