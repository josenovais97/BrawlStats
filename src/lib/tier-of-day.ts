import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import {
  DEFAULT_TIER_WINDOW,
  TIER_WINDOWS,
  type TierFormat,
  getMetaMovers,
  getScoredRoster,
} from '@/lib/stats';
import type { MetaMover, Tier } from '@/types/stats';

/**
 * Today's tier list, plus the brawler that gained the most ground and the one
 * that lost the most.
 *
 * The third daily post. The findings carousel answers "what changed today" and
 * the build carousel answers "what should I buy"; this answers "who is strong
 * right now", which is the question the site is actually for and the one the
 * tier list page gets the most traffic on.
 *
 * Everything here is read through the same functions the tier list page uses.
 * That is not tidiness -- a post and a page that score the same window
 * differently is the failure `getScoredRoster` exists to prevent, and it is
 * invisible, because both produce a complete and plausible ranking. Anyone
 * who sees the post and then opens the site has to find the same list.
 */

/**
 * Ranked, over seven days: exactly what `/tier-list/ranked` serves by default.
 *
 * A post showing a different format or window from the page it advertises is a
 * post that makes the site look wrong. `DEFAULT_TIER_WINDOW` rather than a
 * literal '7d' so this follows the page if the default ever moves.
 */
export const TIER_POST_FORMAT: TierFormat = 'ranked';
export const TIER_POST_WINDOW = DEFAULT_TIER_WINDOW;

/**
 * How many brawlers a tier slide shows.
 *
 * S is usually three to six deep and A can run past a dozen. A slide listing
 * fourteen names at a readable size does not fit in 1080x1920 inside TikTok's
 * safe area, and a list nobody can read is worse than a shorter one, so the
 * slide says how many were left out rather than shrinking to fit.
 */
export const PER_TIER = 6;

/**
 * Movement is measured over the same span the list is.
 *
 * `getMetaMovers` defaults to a seven-day lookback, which matches the seven-day
 * window the ranking above is computed over. Pairing a 7d tier list with a 1d
 * delta would put two different questions on one carousel, and the slide would
 * be answering neither cleanly.
 *
 * It also makes the numbers stabler. A one-day delta reshuffles the leaderboard
 * every morning, which reads as noise precisely because it is: the discovery
 * feed already carries the overnight view, with its own floor, for the days
 * when an overnight move is genuinely the story.
 */
const MOVER_LOOKBACK_DAYS = 7;

/**
 * Floors for calling something the biggest riser or faller.
 *
 * Deliberately the same numbers `compute_getDailyDiscoveries` uses for
 * `overnight-rise`. Two posts a day drawn from one database must not
 * contradict each other, and the cheapest way to guarantee that is to make
 * them apply the same test to the same source rather than each picking a
 * threshold that seemed reasonable at the time.
 *
 * Below these, there is no mover worth a slide and the slide is left out --
 * see `plan()` in tier-slides. A quiet week is a real answer.
 */
const MIN_SAMPLE_FOR_MOVER = 300;
const MIN_MOVE = 0.2;

export interface TierPostEntry {
  brawlerId: number;
  name: string;
  /** The catalogue's portrait, which is documented to actually resolve. */
  imageUrl: string | null;
  metaScore: number;
  winRate: number | null;
  usageRate: number | null;
}

export interface TierPost {
  date: string;
  /** '7d', for the slide to say what it measured. */
  windowLabel: string;
  /** S tier, best first. */
  top: TierPostEntry[];
  /** A tier, best first. */
  strong: TierPostEntry[];
  /** The bottom of the list: F, or E when nothing is in F. */
  avoid: TierPostEntry[];
  /** Which tier `avoid` actually came from, so the slide can name it. */
  avoidTier: Tier | null;
  /** How many brawlers cleared the sample floor and were ranked at all. */
  rated: number;
  /** Totals behind the whole ranking, for the method line. */
  battles: number;
  riser: MetaMover | null;
  faller: MetaMover | null;
}

export async function tierOfDay(date: string): Promise<TierPost | null> {
  const [roster, movers, catalog] = await Promise.all([
    getScoredRoster(TIER_WINDOWS[TIER_POST_WINDOW].days, undefined, TIER_POST_FORMAT).catch(
      () => [],
    ),
    getMetaMovers(MOVER_LOOKBACK_DAYS).catch(() => [] as MetaMover[]),
    getBrawlerCatalog().catch(() => null),
  ]);

  // A ranking of nothing is not a post. The job treats null as "nothing
  // today" rather than as a failure, the same as the other two carousels --
  // a morning when the sampler has not produced enough to rank anybody is a
  // quiet day, not a broken pipeline.
  const rated = roster.filter((b) => b.tier !== null);
  if (rated.length === 0) return null;

  const entry = (b: (typeof rated)[number]): TierPostEntry => ({
    brawlerId: b.brawlerId,
    name: b.brawlerName,
    imageUrl: catalog?.byId.get(b.brawlerId)?.imageUrl ?? null,
    metaScore: b.metaScore ?? 0,
    winRate: b.normalizedWinRate,
    usageRate: b.usageRate,
  });

  const inTier = (tier: Tier) =>
    rated
      .filter((b) => b.tier === tier)
      .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
      .map(entry);

  const f = inTier('F');
  const e = inTier('E');
  // F first, E only when F is empty. Both are "do not pick this", and on a
  // week when nothing is bad enough for F the slide should still have
  // something to say rather than being dropped.
  const avoid = f.length > 0 ? f : e;
  const avoidTier: Tier | null = f.length > 0 ? 'F' : e.length > 0 ? 'E' : null;

  const eligible = movers.filter(
    (m) => m.sampleSize >= MIN_SAMPLE_FOR_MOVER && Math.abs(m.metaScoreDelta) >= MIN_MOVE,
  );
  const byDelta = [...eligible].sort((a, b) => b.metaScoreDelta - a.metaScoreDelta);
  const riser = byDelta[0] && byDelta[0].metaScoreDelta > 0 ? byDelta[0] : null;
  const last = byDelta[byDelta.length - 1];
  const faller = last && last.metaScoreDelta < 0 ? last : null;

  return {
    date,
    windowLabel: TIER_WINDOWS[TIER_POST_WINDOW].sublabel,
    top: inTier('S'),
    strong: inTier('A'),
    avoid,
    avoidTier,
    rated: rated.length,
    battles: rated.reduce((sum, b) => sum + b.decidedSampleSize, 0),
    riser,
    // A single brawler cannot be both the biggest riser and the biggest
    // faller, but with one eligible mover `byDelta[0]` and the last element
    // are the same row -- which would put the same brawler on both slides
    // with opposite framing.
    faller: faller && faller.brawlerId !== riser?.brawlerId ? faller : null,
  };
}
