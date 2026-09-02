import 'server-only';

import { getBrawlerCatalog } from '@/lib/brawler-catalog';

import { unstable_cache } from 'next/cache';

import { cache } from 'react';

import type { BrawlerStat as BrawlerStatModel } from '@/generated/prisma/client';
import { stripGameMarkup } from '@/lib/format';
import { getPrisma } from '@/lib/prisma';
import { brawlerPath, slugify } from '@/lib/slugs';
import type {
  AggregationRunSummary,
  BrawlerBuild,
  BrawlerPlacement,
  BrawlerStatRow,
  CatalogChangeEntry,
  MapConfidence,
  MetaMover,
  ModeBestPicks,
  RankedMapPick,
  RankedMapPicks,
  ModePick,
  Tier,
  TrophyGain,
  TrophyStanding,
} from '@/types/stats';

/**
 * Records a read failure that is being degraded to an empty result.
 *
 * Every database read in this file falls back rather than throwing, because
 * the site is built to work without a database — that behaviour is deliberate
 * and stays. What was wrong was doing it *silently*. On 2026-08-27 a Docker
 * build with no DATABASE_URL prerendered empty tier lists into the shipped
 * HTML, and because these catches said nothing the logs were clean, so the
 * cause took a long hunt to find. An empty page with a clean log is the worst
 * possible combination to debug.
 */
function swallow(where: string, error: unknown): void {
  console.error(`[stats] ${where} degraded to an empty result:`, error);
}


/**
 * Read side of the aggregation pipeline. Every function returns null (or an
 * empty result) when no database is configured, so the site stays functional
 * before Neon is provisioned.
 */

/**
 * Below this many *decided* battles the win rate is noise, so the tier list
 * shows the brawler as unrated rather than pretending to rank it.
 */
export const MIN_SAMPLE_FOR_TIER = 20;

/**
 * Battle types the win rate is computed from, shared by the write side
 * (`lib/aggregation.ts`) and every read that ranks brawlers.
 *
 * The API's `"ranked"` type is the trophy ladder, not the competitive mode, and
 * the distinction decides whether a ranking means anything. Measured over a
 * week of our own samples: trophy-ladder battles came back at a 78.0% win rate,
 * because a pool seeded from the global trophy leaderboard is mostly strong
 * players farming weaker lobbies. The same players in competitive Ranked won
 * 54.3%, where matchmaking pairs comparable opponents, so what is left is
 * closer to the brawler's own contribution.
 */
/**
 * How long a computed read is cached.
 *
 * Matched to the sampler: caching longer than the data changes means serving
 * numbers that are stale for no reason, and caching shorter means recomputing
 * an answer that cannot have moved. The sampler went from three hours to two
 * on 2026-08-27, so this followed it.
 */
const READ_CACHE_SECONDS = 7200;

export const COMPETITIVE_BATTLE_TYPES = ['soloRanked', 'teamRanked'] as const;

/**
 * Which half of the sample a tier list is built from.
 *
 * The two are genuinely different games and were never comparable, which is
 * why they get a page each rather than a toggle over one ranking:
 *
 * - `ranked` — competitive Ranked only (COMPETITIVE_BATTLE_TYPES). Matchmaking
 *   pairs comparable opponents, 3v3 modes only, no showdown. This is the list
 *   that answers "what is strong when both teams are trying".
 * - `trophy` — everything else, i.e. the trophy ladder. Far more data (roughly
 *   5x), the whole roster clears the sample floor, and showdown exists here.
 *   It answers "what is strong on ladder", where the answer is legitimately
 *   different.
 *
 * The format scopes *both* rates. Mixing them — a Ranked win rate against a
 * pick rate counted over every battle, which is what the single page used to
 * do — describes no population at all.
 */
export type TierFormat = 'ranked' | 'trophy';

export function isTierFormat(value: string | undefined): value is TierFormat {
  return value === 'ranked' || value === 'trophy';
}

/** Prisma `battleType` filter selecting one side of the split. */
function battleTypeFilter(format: TierFormat) {
  return format === 'ranked'
    ? { in: [...COMPETITIVE_BATTLE_TYPES] }
    : { notIn: [...COMPETITIVE_BATTLE_TYPES] };
}

/**
 * Floor for per-mode picks. Lower than MIN_SAMPLE_FOR_TIER because splitting by
 * mode divides the sample thirteen ways; shrinkage carries more of the load.
 */
const MIN_SAMPLE_FOR_MODE_PICK = 12;

/**
 * Strength of the prior pulling a brawler's win rate toward the cohort mean,
 * expressed in pseudo-battles.
 *
 * Without it the top of the tier list is whichever rarely-played brawler had a
 * lucky week: a 90% win rate over 50 battles outranked an 86% rate over 1,300.
 * At k=50 a brawler needs roughly 50 decided battles before its own record
 * outweighs the prior, which is about where the noise stops dominating.
 */
const PRIOR_BATTLES = 50;

/** Keeps a re-centred rate inside 0-1 after the baseline has been shifted out. */
function clampRate(rate: number): number {
  return Math.min(Math.max(rate, 0), 1);
}

/**
 * Re-centres a brawler's win rate on the sampled population's mean, damped by
 * how much evidence there actually is.
 *
 * Two corrections happen here. First, empirical-Bayes shrinkage: a brawler
 * with few battles is pulled toward the cohort baseline, so thin samples
 * cannot reach the top of the list on noise alone. Second, the baseline is
 * subtracted and the result re-centred on 50%, turning the number into "better
 * or worse than average *within this sample*", which is the comparison a tier
 * list is actually making.
 *
 * Neither fixes bias in *which* brawlers get played, only in how often the
 * sampled players win. The cohort bias itself is handled upstream, by
 * computing win rates from competitive battles only — see
 * COMPETITIVE_BATTLE_TYPES in `lib/aggregation.ts`.
 */
export function normalizeWinRate(
  winRate: number | null,
  baselineWinRate: number | null,
  decidedSampleSize = 0,
): number | null {
  if (winRate === null) return null;
  if (baselineWinRate === null || baselineWinRate <= 0) return winRate;

  const shrunk =
    decidedSampleSize > 0
      ? (winRate * decidedSampleSize + baselineWinRate * PRIOR_BATTLES) /
        (decidedSampleSize + PRIOR_BATTLES)
      : baselineWinRate;

  return clampRate(shrunk - baselineWinRate + 0.5);
}

/**
 * Meta score: one 0-10 number combining how well a brawler performs with how
 * much it is actually played.
 *
 * Ranking on win rate alone has a specific failure mode. Shrinkage stops a
 * 20-battle fluke reaching the top, but it cannot distinguish a genuinely
 * strong staple from a niche pick that happens to win: a brawler played in
 * 0.13% of battles at 52% and one played in 3.4% at 52% get the same score,
 * even though only the second is actually shaping the meta.
 *
 * Pick rate is deliberately log-scaled. The roster spans two orders of
 * magnitude of usage (roughly 0.1% to 17%), so on a linear scale every brawler
 * outside the top handful would collapse into the same value.
 */

/**
 * Score anchors, per tier-list format.
 *
 * Within a format these stay absolute, for the original reason: a brawler's
 * score should mean the same thing across windows and modes rather than being
 * rescaled by whoever happens to be present. Across formats they cannot be
 * shared, because Ranked and the trophy ladder are different populations
 * measured against different denominators — the two pages never put their
 * numbers side by side, so one scale per page is the honest arrangement.
 *
 * Both sets are anchored just outside the format's own 5th-95th percentile,
 * measured over the sampled data:
 *
 *   ranked  pick 0.42%-4.27%   adjusted win 42.1%-56.1%
 *   trophy  pick 0.31%-1.45%   adjusted win 39.2%-55.0%
 *
 * Trophy sits lower and tighter on both axes, and reusing the Ranked anchors
 * put 62% of the ladder roster in D. The floors are the same judgement call in
 * each case, just made against the right distribution.
 */
const SCORE_ANCHORS = {
  ranked: { pickFloor: 0.001, pickCeiling: 0.05, winFloor: 0.42, winCeiling: 0.6 },
  trophy: { pickFloor: 0.0015, pickCeiling: 0.015, winFloor: 0.39, winCeiling: 0.57 },
} as const satisfies Record<TierFormat, {
  pickFloor: number;
  pickCeiling: number;
  winFloor: number;
  winCeiling: number;
}>;

/** Performance carries most of the weight; popularity breaks the ties. */
const WIN_WEIGHT = 0.65;
const PICK_WEIGHT = 0.35;

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

export function metaScore(
  normalizedWinRate: number | null,
  usageRate: number | null,
  format: TierFormat = 'ranked',
): number | null {
  if (normalizedWinRate === null) return null;

  const { pickFloor, pickCeiling, winFloor, winCeiling } = SCORE_ANCHORS[format];

  const win = clamp01((normalizedWinRate - winFloor) / (winCeiling - winFloor));

  const pick =
    usageRate && usageRate > 0
      ? clamp01(
          (Math.log10(usageRate) - Math.log10(pickFloor)) /
            (Math.log10(pickCeiling) - Math.log10(pickFloor)),
        )
      : 0;

  return Math.round((win * WIN_WEIGHT + pick * PICK_WEIGHT) * 10 * 10) / 10;
}

/**
 * Cut-offs on the meta score, replacing the old win-rate-only thresholds.
 */
const SCORE_THRESHOLDS: { tier: Tier; minScore: number }[] = [
  { tier: 'S', minScore: 7.5 },
  { tier: 'A', minScore: 6.5 },
  { tier: 'B', minScore: 5.5 },
  { tier: 'C', minScore: 4.0 },
  { tier: 'D', minScore: 0 },
];

/** Expects a meta score from `metaScore`. */
export function assignTierFromScore(score: number | null): Tier | null {
  if (score === null) return null;
  return SCORE_THRESHOLDS.find((t) => score >= t.minScore)?.tier ?? 'D';
}

/**
 * Cut-offs on the normalized win rate. Brawl Stars is zero-sum, so once the
 * cohort bias is removed the mean sits at 50% and meaningful separation
 * happens in a narrow band around it.
 */
const TIER_THRESHOLDS: { tier: Tier; minWinRate: number }[] = [
  { tier: 'S', minWinRate: 0.55 },
  { tier: 'A', minWinRate: 0.52 },
  { tier: 'B', minWinRate: 0.485 },
  { tier: 'C', minWinRate: 0.45 },
  { tier: 'D', minWinRate: 0 },
];

/** Expects an already-normalized win rate — see `normalizeWinRate`. */
export function assignTier(normalizedWinRate: number | null): Tier | null {
  if (normalizedWinRate === null) return null;
  return TIER_THRESHOLDS.find((t) => normalizedWinRate >= t.minWinRate)?.tier ?? 'D';
}

// Re-exported so the many server callers keep importing tiers from one place,
// while `lib/tiers` stays importable from client components.
export { TIER_COLOR, TIER_ORDER } from '@/lib/tiers';

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The first day a `windowDays` window covers, as UTC midnight.
 *
 * The roll-ups key on a `DATE`, and comparing one against a timestamp is a
 * quiet bug: Postgres widens the date to midnight, so `day >= now() - 7 days`
 * drops the oldest day for any request made after 00:00 and the window
 * silently narrows as the day goes on. A page rendered at 23:00 would measure
 * less than one rendered at 01:00, from the same data.
 *
 * Flooring to a UTC day fixes both halves of that: the window is exactly
 * `windowDays` calendar days ending today, and it is the same window for every
 * request made on that day — which also means two callers asking for the same
 * window get byte-identical results, rather than results that drift apart by a
 * day's worth of battles.
 */
export function windowStartUtc(windowDays: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (windowDays - 1)),
  );
}

/** Prisma row -> plain serialisable shape the pages render. */
function toStatRow(row: BrawlerStatModel): BrawlerStatRow {
  return {
    brawlerId: row.brawlerId,
    brawlerName: row.brawlerName,
    snapshotDate: toIsoDate(row.snapshotDate),
    winRate: row.winRate,
    baselineWinRate: row.baselineWinRate,
    usageRate: row.usageRate,
    avgTrophies: row.avgTrophies,
    avgRank: row.avgRank,
    sampleSize: row.sampleSize,
    decidedSampleSize: row.decidedSampleSize,
    ownerSampleSize: row.ownerSampleSize,
    windowDays: row.windowDays,
  };
}

/**
 * Rows from the most recent snapshot date present in the table. Returns an
 * empty array both when there is no database and when nothing has been
 * aggregated yet — callers distinguish via `hasDatabase()` if they care.
 */
async function compute_getLatestBrawlerStats(): Promise<BrawlerStatRow[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const latest = await prisma.brawlerStat.findFirst({
      orderBy: { snapshotDate: 'desc' },
      select: { snapshotDate: true },
    });
    if (!latest) return [];

    const rows = await prisma.brawlerStat.findMany({
      where: { snapshotDate: latest.snapshotDate },
      orderBy: [{ winRate: 'desc' }, { usageRate: 'desc' }],
    });

    return rows.map(toStatRow);
  } catch (error) {
    swallow('compute_getLatestBrawlerStats', error);
    // A missing table or an unreachable database must not break the page.
    return [];
  }
}

/** Latest aggregated row for a single brawler, or null if there is none. */
async function compute_getBrawlerStat(brawlerId: number): Promise<BrawlerStatRow | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const row = await prisma.brawlerStat.findFirst({
      where: { brawlerId },
      orderBy: { snapshotDate: 'desc' },
    });
    return row ? toStatRow(row) : null;
  } catch (error) {
    swallow('compute_getBrawlerStat', error);
    return null;
  }
}

/**
 * How far the cohort baseline may move between two snapshots before they stop
 * being comparable at all.
 *
 * The baseline is a one-number summary of *what was measured*: the mean win
 * rate across the whole sample. Real cohort drift between daily snapshots is
 * a fraction of a point. A large jump means the pipeline itself changed —
 * which is exactly what happened when win rates moved to competitive-only
 * battles and the baseline fell from 72.8% to 53.7% overnight. Re-centring
 * cancels the mean shift but not the change in what is being counted, so
 * every brawler appeared to move by up to 14 points. Snapshots either side of
 * such a jump are not comparable and are skipped.
 */
const MAX_BASELINE_SHIFT = 0.08;

/**
 * Which brawlers gained or lost ground since the last comparable snapshot.
 *
 * Movement is measured on the **meta score**, not on win rate alone. The tier
 * list ranks and assigns tiers on that score, so ranking movers on win rate
 * meant the two disagreed: a brawler whose win rate held while its pick rate
 * collapsed is falling down the tier list without ever showing up here. Both
 * inputs are still returned so a move can be explained rather than asserted.
 */
async function compute_getMetaMovers(lookbackDays = 7): Promise<MetaMover[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const latest = await prisma.brawlerStat.findFirst({
      orderBy: { snapshotDate: 'desc' },
      select: { snapshotDate: true, baselineWinRate: true },
    });
    if (!latest || latest.baselineWinRate === null) return [];

    const cutoff = new Date(latest.snapshotDate);
    cutoff.setUTCDate(cutoff.getUTCDate() - lookbackDays);

    // Every older snapshot with the baseline it was computed under, newest
    // first. One row per date is enough: the baseline is sample-wide, so it is
    // identical across a snapshot's rows.
    const candidates = await prisma.brawlerStat.groupBy({
      by: ['snapshotDate'],
      where: { snapshotDate: { lt: latest.snapshotDate } },
      _max: { baselineWinRate: true },
      orderBy: { snapshotDate: 'desc' },
    });

    const comparable = candidates.filter((c) => {
      const baseline = c._max.baselineWinRate;
      if (baseline === null) return false;
      return Math.abs(baseline - latest.baselineWinRate!) <= MAX_BASELINE_SHIFT;
    });
    if (comparable.length === 0) return [];

    // Prefer the newest comparable snapshot at or before the cutoff; if the
    // dataset is too young for that, fall back to the oldest comparable one,
    // which is the widest honest span available.
    const earlier =
      comparable.find((c) => c.snapshotDate <= cutoff) ??
      comparable[comparable.length - 1];

    const nowRows = await prisma.brawlerStat.findMany({
      where: { snapshotDate: latest.snapshotDate },
    });
    const thenRows = await prisma.brawlerStat.findMany({
      where: { snapshotDate: earlier.snapshotDate },
    });

    const before = new Map(thenRows.map((r) => [r.brawlerId, r]));
    const movers: MetaMover[] = [];

    for (const row of nowRows) {
      const prev = before.get(row.brawlerId);
      if (!prev) continue;

      const nowRate = normalizeWinRate(
        row.winRate,
        row.baselineWinRate,
        row.decidedSampleSize,
      );
      const prevRate = normalizeWinRate(
        prev.winRate,
        prev.baselineWinRate,
        prev.decidedSampleSize,
      );
      if (nowRate === null || prevRate === null) continue;

      // Both sides must clear the sample floor, or the "movement" is noise.
      if (
        row.decidedSampleSize < MIN_SAMPLE_FOR_TIER ||
        prev.decidedSampleSize < MIN_SAMPLE_FOR_TIER
      ) {
        continue;
      }

      const nowScore = metaScore(nowRate, row.usageRate);
      const prevScore = metaScore(prevRate, prev.usageRate);
      if (nowScore === null || prevScore === null) continue;

      movers.push({
        brawlerId: row.brawlerId,
        brawlerName: row.brawlerName,
        metaScoreNow: nowScore,
        metaScoreBefore: prevScore,
        metaScoreDelta: nowScore - prevScore,
        tierNow: assignTierFromScore(nowScore) ?? 'D',
        tierBefore: assignTierFromScore(prevScore) ?? 'D',
        winRateNow: nowRate,
        winRateBefore: prevRate,
        winRateDelta: nowRate - prevRate,
        usageNow: row.usageRate,
        usageBefore: prev.usageRate,
        usageDelta:
          row.usageRate !== null && prev.usageRate !== null
            ? row.usageRate - prev.usageRate
            : null,
        sampleSize: row.decidedSampleSize,
        fromDate: toIsoDate(earlier.snapshotDate),
        toDate: toIsoDate(latest.snapshotDate),
      });
    }

    return movers.sort(
      (a, b) => Math.abs(b.metaScoreDelta) - Math.abs(a.metaScoreDelta),
    );
  } catch (error) {
    swallow('compute_getMetaMovers', error);
    return [];
  }
}

/** Most recent detected catalogue changes, newest first. */
async function compute_getCatalogChanges(limit = 40): Promise<CatalogChangeEntry[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const rows = await prisma.catalogChange.findMany({
      orderBy: [{ detectedOn: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      detectedOn: toIsoDate(row.detectedOn),
      kind: row.kind,
      brawlerId: row.brawlerId,
      brawlerName: row.brawlerName,
      itemId: row.itemId,
      itemName: row.itemName,
    }));
  } catch (error) {
    swallow('compute_getCatalogChanges', error);
    return [];
  }
}

/**
 * Every global brawler leaderboard this player appears on.
 *
 * The rankings endpoint tops out at 200 entries, so 200 is the deepest
 * placement that exists — there is no top-500 to show.
 */
export async function getPlayerBrawlerPlacements(
  playerTag: string,
): Promise<BrawlerPlacement[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const rows = await prisma.brawlerRankingEntry.findMany({
      where: { playerTag, region: 'global' },
      orderBy: { rank: 'asc' },
    });

    return rows.map((row) => ({
      brawlerId: row.brawlerId,
      brawlerName: row.brawlerName,
      rank: row.rank,
      trophies: row.trophies,
      region: row.region,
    }));
  } catch (error) {
    swallow('getPlayerBrawlerPlacements', error);
    return [];
  }
}

/** Ability-ownership rates for one brawler, newest snapshot. */
export async function getBrawlerBuild(brawlerId: number): Promise<BrawlerBuild | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const latest = await prisma.brawlerBuildStat.findFirst({
      where: { brawlerId },
      orderBy: { snapshotDate: 'desc' },
      select: { snapshotDate: true },
    });
    if (!latest) return null;

    const rows = await prisma.brawlerBuildStat.findMany({
      where: { brawlerId, snapshotDate: latest.snapshotDate },
      orderBy: { owners: 'desc' },
    });
    if (rows.length === 0) return null;

    /**
     * Share is normalised *within a kind*, not against every owner of the
     * brawler.
     *
     * The raw unlock rate is misleading here: most sampled players own a
     * brawler without having unlocked anything on it, so every option lands on
     * a similar small number (two star powers both showing ~16% of all
     * owners), which reads like a broken percentage rather than a comparison.
     * Dividing by the total unlocks of that kind makes the options sum to
     * 100% and answers the question actually being asked — of everyone who has
     * unlocked one of these, which do they have?
     *
     * A genuine 50/50 is a real answer: it means players unlock both.
     */
    const pick = (kind: string) => {
      const ofKind = rows.filter((r) => r.kind === kind);
      const totalPicks = ofKind.reduce((sum, r) => sum + r.owners, 0);

      return ofKind.map((r) => ({
        itemId: r.itemId,
        share: totalPicks > 0 ? r.owners / totalPicks : 0,
        unlockRate: r.totalOwners > 0 ? r.owners / r.totalOwners : 0,
        owners: r.owners,
      }));
    };

    return {
      brawlerId,
      sampleSize: rows[0].totalOwners,
      starPowers: pick('starPower'),
      gadgets: pick('gadget'),
      gears: pick('gear'),
    };
  } catch (error) {
    swallow('getBrawlerBuild', error);
    return null;
  }
}

/**
 * Where a trophy count sits against every player we have sampled.
 *
 * Returns null below a minimum population, because a percentile drawn from a
 * handful of rows says nothing.
 */
export async function getTrophyPercentile(trophies: number): Promise<TrophyStanding | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const total = await prisma.sampledPlayer.count({ where: { trophies: { not: null } } });
    if (total < 100) return null;

    const below = await prisma.sampledPlayer.count({
      where: { trophies: { not: null, lt: trophies } },
    });

    return { percentile: below / total, population: total };
  } catch (error) {
    swallow('getTrophyPercentile', error);
    return null;
  }
}

/**
 * How many distinct buffies have actually been observed across the sampled
 * population, per kind.
 *
 * The API publishes no buffie catalogue, and assuming three per brawler
 * overstates the total — not every brawler has one released. Counting the
 * distinct (brawler, kind) pairs anyone in a large maxed-out sample owns is a
 * far closer denominator, and it self-corrects as more ship.
 */
async function compute_getReleasedBuffieCount(): Promise<number | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const rows = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT
        COUNT(DISTINCT CASE WHEN buffie_gadget      THEN brawler_id END) +
        COUNT(DISTINCT CASE WHEN buffie_star_power  THEN brawler_id END) +
        COUNT(DISTINCT CASE WHEN buffie_hyper_charge THEN brawler_id END) AS total
      FROM player_brawler_snapshots
    `;
    const total = Number(rows[0]?.total ?? 0);
    return total > 0 ? total : null;
  } catch (error) {
    swallow('compute_getReleasedBuffieCount', error);
    return null;
  }
}

export interface CoverageStats {
  brawlers: number;
  players: number;
  battles: number;
  /** Competitive Ranked battles only — see `compute_getCoverageStats`. */
  rankedBattles: number;
}

/**
 * Headline counts for the landing page.
 *
 * Real numbers rather than invented ones — if the database is empty the
 * homepage falls back to the brawler count alone rather than showing zeroes.
 */
async function compute_getCoverageStats(): Promise<CoverageStats | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    // Sequential so the page never needs more than one connection.
    const players = await prisma.sampledPlayer.count();
    // Summed from the roll-up, which is now the only table that spans the
    // whole retained window — counting `battle_samples` would report the last
    // few days and read as a collapse in coverage.
    const battleAgg = await prisma.battleDailyStat.aggregate({ _sum: { battles: true } });
    const battles = battleAgg._sum.battles ?? 0;
    /*
     * Competitive battles from the roll-up, not `brawlerRankingEntry.count()`.
     *
     * That count was the brawler *leaderboard* table, which the game API caps
     * at 200 entries per brawler. With 106 brawlers it is pinned at 21,200 and
     * is replaced wholesale on every run, so it sat unchanged at "21.2K" for
     * days next to three counters that were climbing — which reads as the
     * sampler having stopped. It was never a measure of sampling at all.
     *
     * This counts what the label claims: Ranked battles actually observed.
     */
    const rankedAgg = await prisma.battleDailyStat.aggregate({
      _sum: { battles: true },
      where: { battleType: { in: [...COMPETITIVE_BATTLE_TYPES] } },
    });
    const rankedBattles = rankedAgg._sum.battles ?? 0;
    const brawlers = await prisma.brawlerCatalogEntry.findMany({
      distinct: ['brawlerId'],
      select: { brawlerId: true },
    });

    return {
      brawlers: brawlers.length,
      players,
      battles,
      rankedBattles,
    };
  } catch (error) {
    swallow('compute_getCoverageStats', error);
    return null;
  }
}

/** Most recent cron run, used to show data freshness on the tier list. */
/*
 * Deliberately NOT cached, unlike every other read in this file.
 *
 * This is the site's freshness claim — "Sampled 2 hours ago" under the
 * numbers — and a cached freshness claim is a contradiction. Wrapping it at
 * the same one-hour TTL as everything else made the homepage report a run that
 * had already been superseded, so a sampling run could finish and the page
 * would still insist the data was two hours old.
 *
 * It costs nothing to leave uncached: one row, ordered by a column with an
 * index on it. The bytes saved by caching it would not register against the
 * transfer budget; the credibility lost does.
 */
export async function getLastAggregationRun(): Promise<AggregationRunSummary | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const run = await prisma.aggregationRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });
    if (!run) return null;

    return {
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      playersSampled: run.playersSampled,
      battlesRecorded: run.battlesRecorded,
      brawlersUpdated: run.brawlersUpdated,
      status: run.status,
      notes: run.notes,
    };
  } catch (error) {
    swallow('getLastAggregationRun', error);
    return null;
  }
}

/**
 * Records a looked-up tag in the sampling pool. Fire-and-forget: a failure
 * here should never affect the page the visitor asked for.
 */
export async function recordLookup(reading: {
  tag: string;
  name?: string;
  trophies: number;
  highestTrophies: number;
  brawlerCount: number;
  iconId?: number;
  rankedElo?: number;
  rankedRankName?: string;
  highestRankedElo?: number;
  highestRankedRankName?: string;
}) {
  const prisma = getPrisma();
  if (!prisma) return;

  const {
    tag,
    name,
    trophies,
    highestTrophies,
    brawlerCount,
    iconId,
    rankedElo,
    rankedRankName,
    highestRankedElo,
    highestRankedRankName,
  } = reading;

  const standing = {
    iconId,
    rankedElo,
    rankedRankName,
    highestRankedElo,
    highestRankedRankName,
  };

  try {
    await prisma.sampledPlayer.upsert({
      where: { tag },
      create: { tag, name, trophies, source: 'lookup', ...standing },
      update: { name, trophies, ...standing },
    });

    // The row above is overwritten on every visit, so it can only say "how
    // many now". This one keeps the history: one point per day, last reading
    // of the day wins, so a refreshed page cannot write unbounded rows.
    await prisma.playerTrophyPoint.upsert({
      where: { playerTag_recordedOn: { playerTag: tag, recordedOn: todayUtcDate() } },
      create: {
        playerTag: tag,
        recordedOn: todayUtcDate(),
        trophies,
        highestTrophies,
        brawlerCount,
      },
      update: { trophies, highestTrophies, brawlerCount },
    });
  } catch (error) {
    swallow('recordLookup', error);
    // Intentionally silent.
  }
}

/** Midnight UTC today, matching the `@db.Date` columns. */
function todayUtcDate(): Date {
  return new Date(`${toIsoDate(new Date())}T00:00:00.000Z`);
}

export interface TrophyPoint {
  date: string;
  trophies: number;
  highestTrophies: number;
  brawlerCount: number;
}

/**
 * A player's recorded trophy history, oldest first.
 *
 * Returns fewer than two points far more often than not — the history only
 * starts the first time a profile is viewed, so a first-time visitor has
 * exactly one. Callers are expected to render nothing rather than a chart of
 * one dot.
 */
export async function getTrophyHistory(
  tag: string,
  days = 90,
): Promise<TrophyPoint[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await prisma.playerTrophyPoint.findMany({
      where: { playerTag: tag, recordedOn: { gte: since } },
      orderBy: { recordedOn: 'asc' },
    });

    return rows.map((row) => ({
      date: toIsoDate(row.recordedOn),
      trophies: row.trophies,
      highestTrophies: row.highestTrophies,
      brawlerCount: row.brawlerCount,
    }));
  } catch (error) {
    swallow('getTrophyHistory', error);
    return [];
  }
}

/**
 * How stale a player's newest snapshot may be and still count as "climbing".
 */
const GAIN_FRESHNESS_DAYS = 3;

/** Widest gap between two snapshots that still yields a meaningful rate. */
const GAIN_MAX_SPAN_DAYS = 7;

/**
 * Biggest trophy climbers, from each player's own two most recent snapshots.
 *
 * `player_brawler_snapshots` stores per-brawler trophies per player per day, so
 * summing a player's rows for a date reconstructs their total on that date.
 *
 * Note this deliberately does *not* compare the two most recent snapshot
 * *dates*. Sampling walks the pool least-recently-sampled first, so any two
 * consecutive days are mostly disjoint sets of players by design: measured on
 * real data, two adjacent snapshot dates covering 535 and 224 players shared
 * exactly one. Pairing each player against their own previous snapshot instead
 * means everyone sampled twice contributes.
 *
 * Because those spans differ per player, ranking is by trophies per day. A
 * five-day gap would otherwise always outrank a one-day gap.
 */
async function compute_getTrophyGains(limit = 10): Promise<TrophyGain[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const rows = await prisma.playerBrawlerSnapshot.groupBy({
      by: ['playerTag', 'snapshotDate'],
      _sum: { trophies: true },
    });
    if (rows.length === 0) return [];

    // Newest snapshot date in the table anchors freshness, so a stale database
    // does not silently publish month-old movement as today's.
    let newestOverall = 0;
    const byPlayer = new Map<string, { date: number; total: number }[]>();
    for (const row of rows) {
      const date = row.snapshotDate.getTime();
      if (date > newestOverall) newestOverall = date;
      const list = byPlayer.get(row.playerTag) ?? [];
      list.push({ date, total: row._sum.trophies ?? 0 });
      byPlayer.set(row.playerTag, list);
    }

    const cutoff = newestOverall - GAIN_FRESHNESS_DAYS * 86_400_000;
    const gains: (TrophyGain & { perDay: number })[] = [];

    for (const [tag, snapshots] of byPlayer) {
      if (snapshots.length < 2) continue;
      snapshots.sort((a, b) => b.date - a.date);
      const [latest, previous] = snapshots;

      if (latest.date < cutoff) continue;

      const days = Math.round((latest.date - previous.date) / 86_400_000);
      if (days < 1 || days > GAIN_MAX_SPAN_DAYS) continue;

      const gain = latest.total - previous.total;
      if (gain <= 0) continue;

      gains.push({
        tag,
        name: null,
        trophies: latest.total,
        gain,
        perDay: gain / days,
        days,
        from: toIsoDate(new Date(previous.date)),
        to: toIsoDate(new Date(latest.date)),
      });
    }

    const top = gains.sort((a, b) => b.perDay - a.perDay).slice(0, limit);
    if (top.length === 0) return [];

    // One lookup for the names rather than one per row.
    const named = await prisma.sampledPlayer.findMany({
      where: { tag: { in: top.map((g) => g.tag) } },
      select: { tag: true, name: true },
    });
    // Rows sampled before names were sanitised still carry the game's colour
    // markup, so it is stripped on the way out too.
    const names = new Map(named.map((n) => [n.tag, n.name && stripGameMarkup(n.name)]));

    return top.map((gain) => ({
      tag: gain.tag,
      name: names.get(gain.tag) ?? null,
      trophies: gain.trophies,
      gain: gain.gain,
      days: gain.days,
      from: gain.from,
      to: gain.to,
    }));
  } catch (error) {
    swallow('compute_getTrophyGains', error);
    return [];
  }
}

/**
 * Below this many competitive battles in a mode, fall back to every battle.
 */
const MIN_COMPETITIVE_FOR_MODE = 40;

/**
 * Placement at or above which a showdown finish counts as a win.
 *
 * Showdown reports `result: "rank"` and a placement instead of victory/defeat,
 * so without this every showdown brawler has zero decided battles and the mode
 * can never show picks. The cut-offs match where the game itself starts
 * awarding trophies: top 4 of 10 in solo, top 2 of 5 teams in duo.
 */
const SHOWDOWN_WIN_RANK: Record<string, number> = {
  soloShowdown: 4,
  duoShowdown: 2,
};

/**
 * Best brawlers per game mode, computed in one pass.
 *
 * The events page renders several slots at once, so this deliberately groups
 * every mode in a single pair of queries rather than issuing one per event.
 *
 * Win rate prefers competitive battles, for the same reason the tier list does:
 * ladder battles measure who was playing, not what they played. But competitive
 * Ranked is 3v3 only, so showdown modes have no ranked data at all and would
 * otherwise never show picks. Those fall back to every battle, where the
 * per-mode baseline still does most of the corrective work.
 *
 * Each mode is scored against its own baseline, because modes are not equally
 * winnable: a 30% win rate is strong in solo showdown and dreadful in gem grab,
 * and one global threshold would rank every showdown brawler last.
 */
async function computeBestPicksByMode(
  perMode = 3,
  windowDays = 7,
): Promise<Map<string, ModeBestPicks>> {
  const prisma = getPrisma();
  const out = new Map<string, ModeBestPicks>();
  if (!prisma) return out;

  try {
    const since = windowStartUtc(windowDays);
    const where = { day: { gte: since } };

    // `rank` is in the grouping so showdown placements can be folded into
    // wins and losses; it is null for every mode that reports a result.
    const [rankedGroups, allGroups] = await Promise.all([
      prisma.battleDailyStat.groupBy({
        by: ['mode', 'brawlerId', 'brawlerName', 'result', 'rank'],
        where: { ...where, battleType: { in: [...COMPETITIVE_BATTLE_TYPES] } },
        _sum: { battles: true },
      }),
      prisma.battleDailyStat.groupBy({
        by: ['mode', 'brawlerId', 'brawlerName', 'result', 'rank'],
        where,
        _sum: { battles: true },
      }),
    ]);

    type Acc = { name: string; wins: number; losses: number; total: number };
    type Groups = typeof allGroups;

    function fold(groups: Groups): Map<string, Map<number, Acc>> {
      const byMode = new Map<string, Map<number, Acc>>();
      for (const g of groups) {
        const mode = byMode.get(g.mode) ?? new Map<number, Acc>();
        const acc = mode.get(g.brawlerId) ?? {
          name: g.brawlerName,
          wins: 0,
          losses: 0,
          total: 0,
        };
        const n = g._sum.battles ?? 0;
        const winRank = SHOWDOWN_WIN_RANK[g.mode];

        if (g.result === 'victory') acc.wins += n;
        else if (g.result === 'defeat') acc.losses += n;
        else if (g.result === 'rank' && winRank !== undefined && g.rank !== null) {
          if (g.rank <= winRank) acc.wins += n;
          else acc.losses += n;
        }

        acc.total += n;
        mode.set(g.brawlerId, acc);
        byMode.set(g.mode, mode);
      }
      return byMode;
    }

    const rankedByMode = fold(rankedGroups);
    const allByMode = fold(allGroups);

    for (const [mode, everything] of allByMode) {
      const competitive = rankedByMode.get(mode);
      const competitiveDecided = competitive
        ? [...competitive.values()].reduce((s, a) => s + a.wins + a.losses, 0)
        : 0;

      const brawlers =
        competitiveDecided >= MIN_COMPETITIVE_FOR_MODE ? competitive! : everything;

      let popWins = 0;
      let popDecided = 0;
      let popTotal = 0;
      for (const acc of brawlers.values()) {
        popWins += acc.wins;
        popDecided += acc.wins + acc.losses;
        popTotal += acc.total;
      }
      if (popDecided === 0) continue;
      const baseline = popWins / popDecided;

      const picks: ModePick[] = [...brawlers]
        .map(([brawlerId, acc]) => {
          const decided = acc.wins + acc.losses;
          const raw = decided > 0 ? acc.wins / decided : 0;
          return {
            brawlerId,
            brawlerName: acc.name,
            winRate: raw,
            pickRate: popTotal > 0 ? acc.total / popTotal : 0,
            decidedSampleSize: decided,
            score: normalizeWinRate(raw, baseline, decided) ?? 0.5,
          };
        })
        .filter((p) => p.decidedSampleSize >= MIN_SAMPLE_FOR_MODE_PICK)
        .sort((a, b) => b.score - a.score)
        .slice(0, perMode);

      if (picks.length === 0) continue;
      out.set(mode, { mode, picks, sampleSize: popDecided, baselineWinRate: baseline });
    }

    return out;
  } catch (error) {
    swallow('computeBestPicksByMode', error);
    return out;
  }
}

/**
 * Windows the tier list can be viewed over.
 *
 * 30d is gone. It was the widest window and the least asked for, and every
 * window costs a distinct URL now that the choice lives in the path rather
 * than a query string — three windows across two formats and a dozen modes is
 * a lot of pages for a view nobody opened.
 *
 * 24h stays, but as a variant rather than the default, because the sample does
 * not support it as one. Measured 2026-08-25: over 24h, 28 of 106 brawlers
 * clear MIN_SAMPLE_FOR_TIER in Ranked against 105 over 7d, and per mode it is
 * a single brawler against 65-76. A default that ranks a quarter of the roster
 * and empties every mode page is a worse answer than a slightly older one.
 *
 * Note that a `days` of 1 means "since UTC midnight", not a trailing 24 hours
 * — see `windowStartUtc`. So the 24h view holds anywhere from minutes to a
 * full day of battles depending on when it is opened, which is the other
 * reason it is not the default.
 */
export const TIER_WINDOWS = {
  '24h': { days: 1, label: 'Meta', sublabel: '24h' },
  '7d': { days: 7, label: 'Recent', sublabel: '7d' },
} as const;

export type TierWindowKey = keyof typeof TIER_WINDOWS;

/**
 * The window a bare tier-list URL means.
 *
 * Load-bearing for the URL scheme: this is the one window that does *not* get
 * a path segment, so that `/tier-list/ranked` and `/tier-list/ranked/7d` never
 * both exist as pages ranking against each other.
 */
export const DEFAULT_TIER_WINDOW: TierWindowKey = '7d';

export function isTierWindow(value: string | undefined): value is TierWindowKey {
  return value !== undefined && value in TIER_WINDOWS;
}

/**
 * Recomputes brawler win and pick rates over an arbitrary window, straight from
 * `battle_daily_stats`, for one tier-list format.
 *
 * The cron writes one precomputed row per brawler per day at a fixed 7-day
 * window, which is what the homepage and brawler pages read. The tier list
 * needs three windows side by side for each of two formats, and storing six
 * rows per brawler per day would mean widening the table's unique key.
 * Recomputing instead is a single grouped query over a table in the tens of
 * thousands of rows, and the page that calls it revalidates hourly, so it runs
 * about once an hour.
 *
 * Unlike `recomputeBrawlerStats`, both rates are scoped to the same battles —
 * see TierFormat for why the old mixed pairing was not measuring anything.
 */
async function computeBrawlerStatsForWindow(
  windowDays: number,
  mode?: string,
  format: TierFormat = 'ranked',
): Promise<BrawlerStatRow[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = windowStartUtc(windowDays);
    const scope = {
      day: { gte: since },
      battleType: battleTypeFilter(format),
      ...(mode ? { mode } : {}),
    };

    // `mode` and `rank` are grouped so showdown placements can be folded into
    // wins and losses, and so each mode can be scored against its own
    // baseline. Both are only load-bearing on the trophy side; Ranked is 3v3
    // throughout, where `rank` is always null and the modes sit within a point
    // or two of each other.
    const [allGroups, resultGroups, totalAgg] = await Promise.all([
      prisma.battleDailyStat.groupBy({
        by: ['brawlerId', 'brawlerName'],
        where: scope,
        _sum: { battles: true },
      }),
      prisma.battleDailyStat.groupBy({
        by: ['brawlerId', 'brawlerName', 'result', 'rank', 'mode'],
        where: scope,
        _sum: { battles: true },
      }),
      prisma.battleDailyStat.aggregate({ where: scope, _sum: { battles: true } }),
    ]);
    const totalBattles = totalAgg._sum.battles ?? 0;

    // Wins and losses twice over: once per (brawler, mode) and once per mode
    // across every brawler. The second is what each brawler is measured
    // against.
    type Tally = { wins: number; losses: number };
    const byBrawlerMode = new Map<string, Tally>();
    const byMode = new Map<string, Tally>();
    const names = new Map<number, string>();

    for (const group of resultGroups) {
      names.set(group.brawlerId, group.brawlerName);

      const winRank = SHOWDOWN_WIN_RANK[group.mode];
      const count = group._sum.battles ?? 0;
      let wins = 0;
      let losses = 0;

      if (group.result === 'victory') wins = count;
      else if (group.result === 'defeat') losses = count;
      else if (group.result === 'rank' && winRank !== undefined && group.rank !== null) {
        if (group.rank <= winRank) wins = count;
        else losses = count;
      } else continue; // draws, and placements in modes with no win cut-off

      const key = `${group.brawlerId}\u0000${group.mode}`;
      const cell = byBrawlerMode.get(key) ?? { wins: 0, losses: 0 };
      cell.wins += wins;
      cell.losses += losses;
      byBrawlerMode.set(key, cell);

      const modeTotal = byMode.get(group.mode) ?? { wins: 0, losses: 0 };
      modeTotal.wins += wins;
      modeTotal.losses += losses;
      byMode.set(group.mode, modeTotal);
    }

    let popWins = 0;
    let popDecided = 0;
    for (const total of byMode.values()) {
      popWins += total.wins;
      popDecided += total.wins + total.losses;
    }
    const globalBaseline = popDecided > 0 ? popWins / popDecided : null;

    const modeBaseline = new Map(
      [...byMode].map(([mode_, total]) => {
        const decided = total.wins + total.losses;
        return [mode_, decided > 0 ? total.wins / decided : globalBaseline] as const;
      }),
    );

    // Fold the per-mode cells back up per brawler, carrying the battles each
    // mode contributed so the baseline can follow the brawler's own mix.
    const perBrawler = new Map<number, Tally & { expectedWins: number }>();
    for (const [key, cell] of byBrawlerMode) {
      const [idPart, mode_] = key.split('\u0000');
      const brawlerId = Number(idPart);
      const acc = perBrawler.get(brawlerId) ?? { wins: 0, losses: 0, expectedWins: 0 };
      acc.wins += cell.wins;
      acc.losses += cell.losses;
      acc.expectedWins +=
        (cell.wins + cell.losses) * (modeBaseline.get(mode_) ?? globalBaseline ?? 0.5);
      perBrawler.set(brawlerId, acc);
    }

    const usage = new Map(
      allGroups.map((g) => [g.brawlerId, { name: g.brawlerName, total: g._sum.battles ?? 0 }]),
    );
    const ids = new Set([...usage.keys(), ...perBrawler.keys()]);
    const snapshotDate = toIsoDate(new Date());

    return [...ids].map((brawlerId) => {
      const all = usage.get(brawlerId);
      const acc = perBrawler.get(brawlerId);
      const decided = acc ? acc.wins + acc.losses : 0;

      return {
        brawlerId,
        brawlerName: all?.name ?? names.get(brawlerId) ?? `Brawler ${brawlerId}`,
        snapshotDate,
        winRate: decided > 0 ? acc!.wins / decided : null,
        // Not the sample-wide mean but this brawler's own: the win rate its
        // mode mix would produce at exactly average performance. A showdown
        // main is judged against showdown, where finishing top 4 of 10 caps
        // the ceiling near 40%, and a Brawl Ball main against Brawl Ball,
        // where this cohort wins closer to 78%. One number for both put every
        // showdown brawler at the bottom of the ladder list.
        baselineWinRate: decided > 0 ? acc!.expectedWins / decided : globalBaseline,
        usageRate: totalBattles > 0 && all ? all.total / totalBattles : null,
        avgTrophies: null,
        avgRank: null,
        sampleSize: all?.total ?? 0,
        decidedSampleSize: decided,
        ownerSampleSize: 0,
        windowDays,
      };
    });
  } catch (error) {
    swallow('computeBrawlerStatsForWindow', error);
    return [];
  }
}

/**
 * A brawler's standing in one tier list: the scored form of a `BrawlerStatRow`.
 *
 * `tier` is null below the sample floor rather than 'D'. The distinction
 * matters everywhere this is read — "we have not measured this" and "we
 * measured this and it is bad" are different claims, and collapsing them was
 * how the old page ended up implying the second about brawlers it had 3
 * battles for.
 */
export interface ScoredBrawler {
  brawlerId: number;
  brawlerName: string;
  normalizedWinRate: number | null;
  metaScore: number | null;
  tier: Tier | null;
  usageRate: number | null;
  winRate: number | null;
  baselineWinRate: number | null;
  decidedSampleSize: number;
}

/** Applies the scoring pipeline to raw rows. Pure; no artwork, no database. */
export function scoreBrawlers(
  rows: BrawlerStatRow[],
  format: TierFormat,
): ScoredBrawler[] {
  return rows.map((row) => {
    const normalizedWinRate = normalizeWinRate(
      row.winRate,
      row.baselineWinRate,
      row.decidedSampleSize,
    );
    const score = metaScore(normalizedWinRate, row.usageRate, format);
    const rated =
      normalizedWinRate !== null && row.decidedSampleSize >= MIN_SAMPLE_FOR_TIER;

    return {
      brawlerId: row.brawlerId,
      brawlerName: row.brawlerName,
      normalizedWinRate,
      metaScore: score,
      tier: rated ? (assignTierFromScore(score) ?? 'D') : null,
      usageRate: row.usageRate,
      winRate: row.winRate,
      baselineWinRate: row.baselineWinRate,
      decidedSampleSize: row.decidedSampleSize,
    };
  });
}

/**
 * The current tier list keyed by brawler id, for pages that need to look up a
 * few brawlers rather than render the whole ranking — the profile page joining
 * a player's roster against the meta, mainly.
 */
export const getMetaIndex = cache(
  async (
    format: TierFormat = 'ranked',
    windowDays = 7,
  ): Promise<Map<number, ScoredBrawler>> => {
    const rows = await getBrawlerStatsForWindow(windowDays, undefined, format);
    return new Map(scoreBrawlers(rows, format).map((entry) => [entry.brawlerId, entry]));
  },
);

/**
 * Elo every account is placed at when a Ranked season resets.
 *
 * Sitting on it means "has not played this season", not "is ranked last", so
 * the board excludes it rather than filling up with tied 750s.
 */
const RANKED_RESET_ELO = 750;

/** A player's Ranked standing, for the Ranked board. */
export interface RankedStanding {
  tag: string;
  name: string | null;
  iconId: number | null;
  trophies: number | null;
  elo: number;
  rankName: string | null;
  peakElo: number;
  peakRankName: string | null;
}

/**
 * Top sampled players by *current* Ranked elo.
 *
 * There is no upstream equivalent: the game API publishes trophy leaderboards
 * for players, clubs and individual brawlers, but nothing for Ranked. This is
 * assembled from the standing recorded on each sample, so it ranks the pool we
 * have seen rather than the world — the page says as much rather than dressing
 * it up as global.
 *
 * Ordered on the live season standing, matching what the trophy board does:
 * a leaderboard answers "who is on top now". The all-time peak is carried
 * alongside each row rather than used for ordering, because it is context
 * about the player rather than their current position. The consequence is that
 * the board thins out just after a season reset, when most of the pool sits at
 * the 750 floor — which is the same thing the in-game ladder does.
 */
async function compute_getRankedLeaderboard(
  limit = 100,
): Promise<{ players: RankedStanding[]; pool: number }> {
  const prisma = getPrisma();
  if (!prisma) return { players: [], pool: 0 };

  try {
    const rows = await prisma.sampledPlayer.findMany({
      // The reset floor is 750 and everyone lands there, so it is not a
      // standing anyone climbed to — requiring more than it keeps the board to
      // players who have actually played this season.
      where: { rankedElo: { gt: RANKED_RESET_ELO } },
      orderBy: [{ rankedElo: 'desc' }, { highestRankedElo: 'desc' }],
      take: limit,
      select: {
        tag: true,
        name: true,
        iconId: true,
        trophies: true,
        rankedElo: true,
        rankedRankName: true,
        highestRankedElo: true,
        highestRankedRankName: true,
      },
    });

    // The pool this ranks, which is not the same as the number of rows shown.
    const pool = await prisma.sampledPlayer.count({
      where: { rankedElo: { gt: RANKED_RESET_ELO } },
    });

    return {
      pool,
      players: rows.map((row) => ({
        tag: row.tag,
        name: row.name && stripGameMarkup(row.name),
        iconId: row.iconId,
        trophies: row.trophies,
        elo: row.rankedElo ?? 0,
        rankName: row.rankedRankName,
        peakElo: row.highestRankedElo ?? 0,
        peakRankName: row.highestRankedRankName,
      })),
    };
  } catch (error) {
    swallow('compute_getRankedLeaderboard', error);
    return { players: [], pool: 0 };
  }
}

/** One cosmetic and how much of the sampled population is wearing it. */
export interface CosmeticUsage {
  id: number;
  name: string;
  /** For skins: which brawler it belongs to. */
  brawlerId?: number;
  brawlerName?: string;
  /** Sampled slots using it. */
  users: number;
  /** Fraction 0-1 of all comparable slots. */
  share: number;
}

/**
 * How many days back a cosmetic reading still counts as current.
 *
 * The sampler walks a least-recently-sampled queue, so a single day would rank
 * whoever happened to be sampled that morning. It now covers the whole pool
 * comfortably within a day, so a week is ample — and it keeps this inside the
 * snapshot retention window, which is set by storage rather than by this query.
 * The `DISTINCT ON` below takes only the newest row per player-brawler anyway,
 * so extra depth costs scan time and buys nothing.
 */
const COSMETIC_WINDOW_DAYS = 7;

/**
 * The most-worn skins across the sampled population.
 *
 * Base skins are excluded from the ranking but *not* from the denominator: a
 * skin worn by 3% of players is a claim about all players, including the ones
 * wearing nothing. Dropping the default from both halves would inflate every
 * share by however many people never bought a skin, which on this dataset is
 * most of them.
 *
 * Counted from each player's most recent snapshot per brawler, so a player who
 * has been sampled thirty times still contributes one vote per brawler.
 */
/** One skin on a brawler, and how much of that brawler's playerbase equips it. */
export interface BrawlerSkinUsage {
  id: number;
  name: string;
  users: number;
  /** Share of players who own this brawler, not of the whole population. */
  share: number;
  /** The skin the brawler ships with, which carries the brawler's own name. */
  isDefault: boolean;
}

/**
 * Which skins the owners of one brawler actually equip.
 *
 * The denominator is the point. `getSkinUsage` ranks skins across the whole
 * game and divides by every player-brawler pair, which is the right question
 * for a leaderboard and the wrong one here: "2% of all accounts" says nothing
 * about whether a Shelly skin is popular. This divides by the people who own
 * *this* brawler, so the number reads as "of players who have Shelly".
 *
 * The default skin is kept rather than filtered out. Globally it would swamp
 * the ranking, which is why the leaderboard drops it; per brawler it is the
 * baseline every other skin is competing with, and usually the honest answer
 * to "what do people actually use".
 *
 * Snapshots are a rotating sample (SNAPSHOT_SAMPLE_RATE), so this is a survey
 * of a quarter of the pool rather than a census -- fine for shares, which is
 * all it reports.
 */
async function compute_getBrawlerSkins(brawlerId: number): Promise<BrawlerSkinUsage[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = windowStartUtc(COSMETIC_WINDOW_DAYS);

    const rows = await prisma.$queryRaw<
      { skin_id: number; skin_name: string; brawler_name: string; users: bigint }[]
    >`
      WITH latest AS (
        SELECT DISTINCT ON (player_tag)
               player_tag, skin_id, skin_name, brawler_name
        FROM player_brawler_snapshots
        WHERE snapshot_date >= ${since}
          AND brawler_id = ${brawlerId}
          AND skin_id IS NOT NULL
        ORDER BY player_tag, snapshot_date DESC
      )
      SELECT skin_id, skin_name, max(brawler_name) AS brawler_name, COUNT(*) AS users
      FROM latest
      GROUP BY skin_id, skin_name
      ORDER BY users DESC
    `;

    const owners = rows.reduce((sum, row) => sum + Number(row.users), 0);
    if (owners === 0) return [];

    return rows.map((row) => {
      const name = row.skin_name.replace(/\s+/g, ' ').trim();
      return {
        id: row.skin_id,
        name,
        users: Number(row.users),
        share: Number(row.users) / owners,
        isDefault: name.toUpperCase() === row.brawler_name.trim().toUpperCase(),
      };
    });
  } catch (error) {
    swallow('compute_getBrawlerSkins', error);
    return [];
  }
}

/**
 * Every skin the sample has seen, not just the top of the board.
 *
 * `getSkinUsage` answers "what is popular right now" in twenty rows; this
 * answers "what exists, and does anyone use it", which is a different page and
 * a much longer list -- around 1,200 skins across the roster.
 *
 * Defaults are excluded, matching the leaderboard: the skin carrying the
 * brawler's own name is not something anyone acquired, and per-brawler
 * adoption is already answered by `getBrawlerSkins`.
 *
 * Shares are of all sampled player-brawler slots, so they are directly
 * comparable between skins of different brawlers -- which is the comparison a
 * catalogue is for.
 */
async function compute_getSkinCatalogue(): Promise<CosmeticUsage[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = windowStartUtc(COSMETIC_WINDOW_DAYS);

    const rows = await prisma.$queryRaw<
      { skin_id: number; skin_name: string; brawler_id: number; brawler_name: string; users: bigint }[]
    >`
      WITH latest AS (
        SELECT DISTINCT ON (player_tag, brawler_id)
               player_tag, brawler_id, brawler_name, skin_id, skin_name
        FROM player_brawler_snapshots
        WHERE snapshot_date >= ${since} AND skin_id IS NOT NULL
        ORDER BY player_tag, brawler_id, snapshot_date DESC
      )
      SELECT skin_id, skin_name, brawler_id, max(brawler_name) AS brawler_name, COUNT(*) AS users
      FROM latest
      WHERE upper(regexp_replace(skin_name, '\s+', ' ', 'g')) <> upper(brawler_name)
      GROUP BY skin_id, skin_name, brawler_id
      ORDER BY users DESC
    `;

    const [{ total }] = await prisma.$queryRaw<{ total: bigint }[]>`
      WITH latest AS (
        SELECT DISTINCT ON (player_tag, brawler_id) player_tag, brawler_id
        FROM player_brawler_snapshots
        WHERE snapshot_date >= ${since} AND skin_id IS NOT NULL
        ORDER BY player_tag, brawler_id, snapshot_date DESC
      )
      SELECT COUNT(*) AS total FROM latest
    `;
    const denominator = Number(total) || 1;

    return rows.map((row) => ({
      id: row.skin_id,
      name: row.skin_name.replace(/\s+/g, ' ').trim(),
      brawlerId: row.brawler_id,
      brawlerName: row.brawler_name.replace(/\s+/g, ' ').trim(),
      users: Number(row.users),
      share: Number(row.users) / denominator,
    }));
  } catch (error) {
    swallow('compute_getSkinCatalogue', error);
    return [];
  }
}

/**
 * Every profile icon the sample has seen.
 *
 * Unlike skins these have artwork -- `playerIconUrl` resolves any id -- so the
 * catalogue can actually show them. The icon lives on the account rather than
 * per brawler, so the denominator is sampled players.
 */
async function compute_getIconCatalogue(): Promise<CosmeticUsage[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const groups = await prisma.sampledPlayer.groupBy({
      by: ['iconId'],
      where: { iconId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { iconId: 'desc' } },
    });

    const total = groups.reduce((sum, group) => sum + group._count._all, 0);
    if (total === 0) return [];

    return groups.map((group) => ({
      id: group.iconId!,
      name: `Icon #${group.iconId}`,
      users: group._count._all,
      share: group._count._all / total,
    }));
  } catch (error) {
    swallow('compute_getIconCatalogue', error);
    return [];
  }
}

async function compute_getSkinUsage(limit = 20): Promise<CosmeticUsage[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = windowStartUtc(COSMETIC_WINDOW_DAYS);

    const rows = await prisma.$queryRaw<
      { skin_id: number; skin_name: string; brawler_id: number; brawler_name: string; users: bigint }[]
    >`
      WITH latest AS (
        SELECT DISTINCT ON (player_tag, brawler_id)
               player_tag, brawler_id, brawler_name, skin_id, skin_name
        FROM player_brawler_snapshots
        WHERE snapshot_date >= ${since} AND skin_id IS NOT NULL
        ORDER BY player_tag, brawler_id, snapshot_date DESC
      )
      SELECT skin_id, skin_name, brawler_id, brawler_name, COUNT(*) AS users
      FROM latest
      -- The default skin carries the brawler's own name. Excluded from the
      -- ranking, still counted in the total below.
      WHERE upper(regexp_replace(skin_name, '\s+', ' ', 'g')) <> upper(brawler_name)
      GROUP BY skin_id, skin_name, brawler_id, brawler_name
      ORDER BY users DESC
      LIMIT ${limit}
    `;

    const [{ total }] = await prisma.$queryRaw<{ total: bigint }[]>`
      WITH latest AS (
        SELECT DISTINCT ON (player_tag, brawler_id) player_tag, brawler_id
        FROM player_brawler_snapshots
        WHERE snapshot_date >= ${since} AND skin_id IS NOT NULL
        ORDER BY player_tag, brawler_id, snapshot_date DESC
      )
      SELECT COUNT(*) AS total FROM latest
    `;

    const denominator = Number(total) || 1;

    return rows.map((row) => ({
      id: row.skin_id,
      name: row.skin_name.replace(/\s+/g, ' ').trim(),
      brawlerId: row.brawler_id,
      brawlerName: row.brawler_name,
      users: Number(row.users),
      share: Number(row.users) / denominator,
    }));
  } catch (error) {
    swallow('compute_getSkinUsage', error);
    return [];
  }
}

/**
 * The most-worn profile icons.
 *
 * Simpler than skins: the icon lives on the account rather than per brawler,
 * and `sampled_players` already holds one row per player, so the latest reading
 * is just the column. No default to exclude — every account has one.
 */
async function compute_getIconUsage(limit = 12): Promise<CosmeticUsage[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const groups = await prisma.sampledPlayer.groupBy({
      by: ['iconId'],
      where: { iconId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { iconId: 'desc' } },
      take: limit,
    });

    const total = await prisma.sampledPlayer.count({ where: { iconId: { not: null } } });
    if (total === 0) return [];

    return groups.map((group) => ({
      id: group.iconId!,
      name: `Icon #${group.iconId}`,
      users: group._count._all,
      share: group._count._all / total,
    }));
  } catch (error) {
    swallow('compute_getIconUsage', error);
    return [];
  }
}

/**
 * Modes with enough sampled battles to be worth offering as a tier-list filter,
 * most-played first. Returned from the data rather than hard-coded so a mode
 * leaving rotation drops out on its own.
 *
 * Scoped to the format, because the two rotations barely overlap: Ranked is six
 * 3v3 modes, while the ladder adds showdown, duels, wipeout and the rest. The
 * unscoped version offered Solo Showdown on a Ranked-only ranking, which could
 * only ever come back empty.
 */
async function computeFilterableModes(
  // Inside ROLLUP_RETENTION_DAYS: asking for more than is kept would quietly
  // narrow to whatever exists, which is fine but hides the real window.
  windowDays = 21,
  minBattles = 150,
  format: TierFormat = 'ranked',
): Promise<{ mode: string; battles: number }[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = windowStartUtc(windowDays);
    const groups = await prisma.battleDailyStat.groupBy({
      by: ['mode'],
      where: { day: { gte: since }, battleType: battleTypeFilter(format) },
      _sum: { battles: true },
    });

    return groups
      .map((g) => ({ mode: g.mode, battles: g._sum.battles ?? 0 }))
      .filter((m) => m.battles >= minBattles)
      .sort((a, b) => b.battles - a.battles);
  } catch (error) {
    swallow('computeFilterableModes', error);
    return [];
  }
}

/* ------------------------------ ability choice ----------------------------- */

/**
 * Which star power or gadget players buy first, and how it performs.
 *
 * The game API never reports an equipped loadout, so a direct usage rate is
 * not obtainable. This is the next best thing, and it is a real measurement
 * rather than a proxy: a player who owns exactly *one* of a brawler's two star
 * powers has chosen that one, and every battle they play on that brawler is
 * played with it. Both halves of that are already recorded, so the join costs
 * nothing new.
 *
 * The comparison is fair in a way an ownership split is not. Everyone counted
 * here owns exactly one, so the two groups are equally invested in the brawler
 * and the difference between them is the ability rather than the player.
 *
 * It has data precisely when the question is live. On a brawler released years
 * ago almost everyone owns both, so there is nothing to measure, but nobody is
 * asking which to buy either. On a recent one the split is wide open: Wendy
 * had over nine hundred attributable battles within three weeks of release.
 */
export interface AbilityChoice {
  itemId: number;
  /** Players who own this one and not the other. */
  choosers: number;
  /** 0-1 share of single-option owners who picked this one. */
  share: number;
  /** Win rate in their battles, or null below the sample floor. */
  winRate: number | null;
  decidedSampleSize: number;
}

export interface BrawlerAbilityChoices {
  starPowers: AbilityChoice[];
  gadgets: AbilityChoice[];
  /** Total players contributing a first-purchase choice. */
  sampleSize: number;
  /**
   * How much weight the split carries.
   *
   * "high" is a brawler people are actively deciding about, where the players
   * who own one are a real share of all owners. "low" is an established one
   * where nearly everyone owns both, so the few who do not are a small,
   * self-selected group and the split is indicative at best.
   */
  confidence: MapConfidence;
}

/**
 * Floor for publishing a first-purchase split.
 *
 * Five is the lowest count that can express a preference at all, and it covers
 * the roster: measured across the pool, all 106 brawlers clear it for star
 * powers and 104 for gadgets. Below it the section still appears and says it
 * has nothing yet, so a reader never has to wonder whether a missing block
 * means "no data" or "no section".
 *
 * Thin samples are not hidden, they are labelled. An established brawler's
 * single-owners are a small and self-selected slice, and the confidence chip
 * says so, which is more useful than an empty section: a reader can see both
 * the number and how much to trust it.
 */
const MIN_CHOOSERS = 5;

/** How much of the playerbase is still choosing, for the confidence label. */
const CHOOSER_SHARE_LIVE = 0.15;

/** Below this many battles a win rate is noise, so it is withheld. */
const MIN_BATTLES_FOR_ABILITY_WIN_RATE = 40;

async function compute_getBrawlerAbilityChoices(
  brawlerId: number,
  windowDays = 21,
): Promise<BrawlerAbilityChoices | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const since = windowStartUtc(windowDays);

    const rows = await prisma.$queryRaw<
      {
        kind: string;
        item_id: number;
        choosers: bigint;
        wins: bigint;
        decided: bigint;
        owners: bigint;
      }[]
    >`
      WITH latest AS (
        SELECT DISTINCT ON (player_tag)
               player_tag, star_power_ids, gadget_ids
        FROM player_brawler_snapshots
        WHERE brawler_id = ${brawlerId} AND snapshot_date >= ${since}
        ORDER BY player_tag, snapshot_date DESC
      ),
      -- Only players who own exactly one, so the choice is unambiguous.
      picked AS (
        SELECT player_tag, 'starPower' AS kind, star_power_ids[1] AS item_id
        FROM latest WHERE cardinality(star_power_ids) = 1
        UNION ALL
        SELECT player_tag, 'gadget' AS kind, gadget_ids[1] AS item_id
        FROM latest WHERE cardinality(gadget_ids) = 1
      ),
      -- From the per-player roll-up rather than the battles themselves: this
      -- window is 21 days and raw rows now live three. The roll-up already
      -- carries wins and decided per (player, brawler, day), which is exactly
      -- the grain this CTE was building.
      battles AS (
        SELECT player_tag,
               SUM(wins) AS wins,
               SUM(decided) AS decided
        FROM player_battle_daily
        WHERE brawler_id = ${brawlerId} AND day >= ${since}
        GROUP BY player_tag
      )
      SELECT p.kind, p.item_id,
             COUNT(*) AS choosers,
             COALESCE(SUM(b.wins), 0) AS wins,
             COALESCE(SUM(b.decided), 0) AS decided,
             (SELECT COUNT(*) FROM latest) AS owners
      FROM picked p
      LEFT JOIN battles b ON b.player_tag = p.player_tag
      GROUP BY p.kind, p.item_id
    `;

    const owners = Number(rows[0]?.owners ?? 0);

    const build = (kind: string): AbilityChoice[] => {
      const forKind = rows.filter((row) => row.kind === kind);
      const total = forKind.reduce((sum, row) => sum + Number(row.choosers), 0);

      // Both gates: enough people to measure, and enough of the playerbase for
      // them to represent it.
      if (total < MIN_CHOOSERS) return [];

      return forKind
        .map((row) => {
          const decided = Number(row.decided);
          return {
            itemId: row.item_id,
            choosers: Number(row.choosers),
            share: Number(row.choosers) / total,
            winRate:
              decided >= MIN_BATTLES_FOR_ABILITY_WIN_RATE
                ? Number(row.wins) / decided
                : null,
            decidedSampleSize: decided,
          };
        })
        .sort((a, b) => b.share - a.share);
    };

    const starPowers = build('starPower');
    const gadgets = build('gadget');
    if (starPowers.length === 0 && gadgets.length === 0) return null;

    const sampleSize =
      starPowers.reduce((sum, c) => sum + c.choosers, 0) +
      gadgets.reduce((sum, c) => sum + c.choosers, 0);

    // Both halves matter: how many people were measured, and whether they are
    // a live slice of the playerbase or the stragglers.
    const share = owners > 0 ? sampleSize / (owners * 2) : 0;
    const confidence: MapConfidence =
      share >= CHOOSER_SHARE_LIVE && sampleSize >= 60
        ? 'high'
        : sampleSize >= 40
          ? 'medium'
          : 'low';

    return { starPowers, gadgets, sampleSize, confidence };
  } catch (error) {
    swallow('compute_getBrawlerAbilityChoices', error);
    return null;
  }
}

/* --------------------------------- buffies -------------------------------- */

/**
 * Which of a brawler's three buffies exist, derived from who owns them.
 *
 * Buffies are the one part of a loadout nothing describes. The official
 * catalogue does not list them at all — they appear only as three booleans on
 * a *player's* brawler — and there is no buffie endpoint on the artwork mirror
 * either. So what a buffie does cannot be shown; whether one exists can, and
 * that falls straight out of the snapshots the popular-build percentages
 * already use.
 *
 * Reported as existence rather than as a percentage, deliberately. A buffie is
 * binary and permanent — there is nothing to choose between and nothing to
 * equip — so an ownership share says something about how long the buffie has
 * been out and nothing at all about the brawler. The only question the data can
 * answer is "does this exist yet", so that is the only question it is asked.
 */
export interface BrawlerBuffies {
  /** Sampled players who own this brawler. */
  owners: number;
  gadget: boolean;
  starPower: boolean;
  hyperCharge: boolean;
  /** True when none of the three has been released for this brawler. */
  none: boolean;
}

/**
 * Share of owners that has to hold a buffie before it counts as released.
 *
 * Not zero: one stray row — a mis-sampled account, a mid-write snapshot —
 * should not flip a brawler to "released". The real distribution is nowhere
 * near this line: measured across the pool, a released buffie sits around
 * 65–90% of owners and an unreleased one at a flat 0%.
 */
const BUFFIE_RELEASED_SHARE = 0.02;

/** Below this many owners the sample cannot say either way. */
const MIN_OWNERS_FOR_BUFFIES = 50;

async function compute_getBrawlerBuffies(
  brawlerId: number,
  windowDays = 7,
): Promise<BrawlerBuffies | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const since = windowStartUtc(windowDays);

    // One row per player per brawler per day, so a player sampled repeatedly
    // would otherwise vote once per day. Counted from each player's most recent
    // snapshot, matching how skin usage is counted.
    const rows = await prisma.$queryRaw<
      { owners: bigint; gadget: bigint; star_power: bigint; hyper_charge: bigint }[]
    >`
      WITH latest AS (
        SELECT DISTINCT ON (player_tag)
               player_tag, buffie_gadget, buffie_star_power, buffie_hyper_charge
        FROM player_brawler_snapshots
        WHERE brawler_id = ${brawlerId} AND snapshot_date >= ${since}
        ORDER BY player_tag, snapshot_date DESC
      )
      SELECT COUNT(*) AS owners,
             COUNT(*) FILTER (WHERE buffie_gadget) AS gadget,
             COUNT(*) FILTER (WHERE buffie_star_power) AS star_power,
             COUNT(*) FILTER (WHERE buffie_hyper_charge) AS hyper_charge
      FROM latest
    `;

    const owners = Number(rows[0]?.owners ?? 0);
    if (owners < MIN_OWNERS_FOR_BUFFIES) return null;

    const released = (count: bigint | undefined) =>
      Number(count ?? 0) / owners >= BUFFIE_RELEASED_SHARE;

    const gadget = released(rows[0].gadget);
    const starPower = released(rows[0].star_power);
    const hyperCharge = released(rows[0].hyper_charge);

    return {
      owners,
      gadget,
      starPower,
      hyperCharge,
      none: !gadget && !starPower && !hyperCharge,
    };
  } catch (error) {
    swallow('compute_getBrawlerBuffies', error);
    return null;
  }
}

/* ----------------------- per-brawler meta breakdowns ---------------------- */

/**
 * Minimum decided battles before a brawler's record in one mode or on one map
 * is shown on its page.
 *
 * Higher than the per-map *eligibility* floor used by the map pages, because
 * this list is read the other way round — "where is this brawler good" invites
 * acting on the top row, and a four-battle top row is a coin flip wearing a
 * percentage sign.
 */
const MIN_SAMPLE_FOR_BRAWLER_SPLIT = 15;

/** One slice of a brawler's record: a mode, or a map within a mode. */
export interface BrawlerSplit {
  /** Mode id as the API reports it, e.g. "gemGrab". */
  mode: string;
  /** Null on a mode-level split. */
  mapName: string | null;
  eventId: number | null;
  winRate: number;
  /** Win rate re-centred on the same slice's own average, so slices compare. */
  score: number;
  decidedSampleSize: number;
}

/**
 * Where a brawler actually performs: its record per mode, and per map.
 *
 * Each slice is scored against *that slice's own* average rather than a global
 * one, for the same reason the mode picks are: modes are not equally winnable,
 * and a raw 34% in solo showdown is a better showing than a raw 48% in gem
 * grab. Without that, every showdown map sorts to the bottom of every brawler's
 * page and the list says nothing.
 */
async function compute_getBrawlerSplits(
  brawlerId: number,
  windowDays = 14,
): Promise<{ modes: BrawlerSplit[]; maps: BrawlerSplit[] }> {
  const prisma = getPrisma();
  const empty = { modes: [], maps: [] };
  if (!prisma) return empty;

  try {
    const since = windowStartUtc(windowDays);
    const where = { day: { gte: since } };

    // Both groupings cover every brawler, not just this one: the averages each
    // slice is scored against have to come from the whole population, or a
    // brawler would be measured against itself.
    const [modeGroups, mapGroups] = await Promise.all([
      prisma.battleDailyStat.groupBy({
        by: ['mode', 'brawlerId', 'result', 'rank'],
        where,
        _sum: { battles: true },
      }),
      prisma.battleDailyStat.groupBy({
        by: ['mode', 'mapName', 'eventId', 'brawlerId', 'result', 'rank'],
        where: { ...where, mapName: { not: null } },
        _sum: { battles: true },
      }),
    ]);

    type Tally = { wins: number; decided: number };
    const add = (into: Map<string, Tally>, key: string, wins: number, decided: number) => {
      const acc = into.get(key) ?? { wins: 0, decided: 0 };
      acc.wins += wins;
      acc.decided += decided;
      into.set(key, acc);
    };

    /**
     * Folds one grouping into "this brawler here" and "everyone here", keyed
     * the same way, so a slice's score is a difference of two numbers that
     * were counted identically.
     */
    function fold<G extends { mode: string; brawlerId: number; result: string; rank: number | null; _sum: { battles: number | null } }>(
      groups: G[],
      keyOf: (g: G) => string,
    ) {
      const mine = new Map<string, Tally>();
      const all = new Map<string, Tally>();

      for (const g of groups) {
        const n = g._sum.battles ?? 0;
        const winRank = SHOWDOWN_WIN_RANK[g.mode];
        let wins = 0;
        let decided = 0;

        if (g.result === 'victory') {
          wins = n;
          decided = n;
        } else if (g.result === 'defeat') {
          decided = n;
        } else if (g.result === 'rank' && winRank !== undefined && g.rank !== null) {
          decided = n;
          if (g.rank <= winRank) wins = n;
        }
        if (decided === 0) continue;

        const key = keyOf(g);
        add(all, key, wins, decided);
        if (g.brawlerId === brawlerId) add(mine, key, wins, decided);
      }

      return { mine, all };
    }

    /** Shrinks the slice toward its own average before re-centring on 50%. */
    function toSplit(
      mine: Tally,
      all: Tally | undefined,
      parts: { mode: string; mapName: string | null; eventId: number | null },
    ): BrawlerSplit | null {
      if (mine.decided < MIN_SAMPLE_FOR_BRAWLER_SPLIT) return null;
      const average = all && all.decided > 0 ? all.wins / all.decided : 0.5;
      const raw = mine.wins / mine.decided;
      const shrunk =
        (mine.wins + average * PRIOR_BATTLES) / (mine.decided + PRIOR_BATTLES);

      return {
        ...parts,
        winRate: raw,
        score: clampRate(shrunk - average + 0.5),
        decidedSampleSize: mine.decided,
      };
    }

    const byMode = fold(modeGroups, (g) => g.mode);
    const modes: BrawlerSplit[] = [];
    for (const [mode, mine] of byMode.mine) {
      const split = toSplit(mine, byMode.all.get(mode), {
        mode,
        mapName: null,
        eventId: null,
      });
      if (split) modes.push(split);
    }

    const byMap = fold(mapGroups, (g) => `${g.mode}\u0000${g.mapName}`);
    const eventIds = new Map<string, number | null>();
    for (const g of mapGroups) {
      const key = `${g.mode}\u0000${g.mapName}`;
      if (g.eventId !== null && !eventIds.get(key)) eventIds.set(key, g.eventId);
    }

    const maps: BrawlerSplit[] = [];
    for (const [key, mine] of byMap.mine) {
      const [mode, mapName] = key.split('\u0000');
      const split = toSplit(mine, byMap.all.get(key), {
        mode,
        mapName,
        eventId: eventIds.get(key) ?? null,
      });
      if (split) maps.push(split);
    }

    const byScore = (a: BrawlerSplit, b: BrawlerSplit) => b.score - a.score;
    return { modes: modes.sort(byScore), maps: maps.sort(byScore) };
  } catch (error) {
    swallow('compute_getBrawlerSplits', error);
    return empty;
  }
}

/** One point on a brawler's meta-score history. */
export interface BrawlerTrendPoint {
  date: string;
  winRate: number | null;
  /** Baseline-adjusted, so cohort drift does not show up as a trend. */
  normalizedWinRate: number | null;
  usageRate: number | null;
  decidedSampleSize: number;
}

/**
 * A brawler's daily snapshots, oldest first.
 *
 * Read straight from the stored `brawler_stats` rows rather than recomputed:
 * those snapshots are what the tier list showed on each day, so a chart of
 * them is a chart of what the site said, not a retroactive re-scoring.
 */
async function compute_getBrawlerTrend(
  brawlerId: number,
  days = 30,
): Promise<BrawlerTrendPoint[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await prisma.brawlerStat.findMany({
      where: { brawlerId, snapshotDate: { gte: since } },
      orderBy: { snapshotDate: 'asc' },
    });

    return rows.map((row) => ({
      date: toIsoDate(row.snapshotDate),
      winRate: row.winRate,
      normalizedWinRate: normalizeWinRate(
        row.winRate,
        row.baselineWinRate,
        row.decidedSampleSize,
      ),
      usageRate: row.usageRate,
      decidedSampleSize: row.decidedSampleSize,
    }));
  } catch (error) {
    swallow('compute_getBrawlerTrend', error);
    return [];
  }
}

/* -------------------------- matchups and synergies ------------------------- */

/**
 * Minimum decided battles behind a single pairing.
 *
 * A matchup splits an already-thin sample by a second brawler, so the floor is
 * what stops the list being a ranking of noise. Pairings below it are dropped
 * entirely rather than shown greyed out: an unreliable counter is worse than
 * no counter, because it will be acted on.
 */
const MIN_SAMPLE_FOR_PAIRING = 20;

export interface BrawlerPairing {
  brawlerId: number;
  winRate: number;
  /** Percentage points above or below this brawler's own overall win rate. */
  edge: number;
  decidedSampleSize: number;
}

export interface BrawlerPairings {
  /** This brawler's win rate across every battle counted here. */
  baseline: number;
  sampleSize: number;
  /** Enemy brawlers, best matchup first. */
  strongAgainst: BrawlerPairing[];
  /** Enemy brawlers, worst matchup first. */
  weakAgainst: BrawlerPairing[];
  /** Team-mates, best synergy first. */
  bestWith: BrawlerPairing[];
}

/**
 * Who this brawler beats, who beats it, and who it wants beside it.
 *
 * Reads `brawler_pair_daily`, the daily roll-up of `battle_team_samples` —
 * so a pairing is counted once, from one side, and never enters the usage or
 * win-rate aggregates that `battle_daily_stats` feeds. The `unnest` that used
 * to expand the id arrays now happens once at roll-up time instead of on every
 * read; this stays raw SQL because the baseline comes from a second table.
 *
 * Every rate is reported as an edge against the brawler's own average in the
 * same sample, not as an absolute. A brawler that wins 58% of everything is
 * not "strong against" the opponent it wins 55% against, and the absolute
 * number would say it was.
 */
async function compute_getBrawlerPairings(
  brawlerId: number,
  windowDays = 21,
  limit = 5,
): Promise<BrawlerPairings | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const since = windowStartUtc(windowDays);

    const [totals, enemies, allies] = await Promise.all([
      // The brawler's own record, which every edge below is measured against.
      // It cannot be recovered from the pairing roll-up, where one battle
      // contributes several pairs, so it is counted once in its own table.
      prisma.$queryRaw<{ wins: bigint; decided: bigint }[]>`
        SELECT COALESCE(SUM(wins), 0) AS wins, COALESCE(SUM(decided), 0) AS decided
        FROM brawler_team_daily
        WHERE brawler_id = ${brawlerId} AND day >= ${since}
      `,
      // Mirrors are excluded at roll-up time rather than here. A brawler
      // against itself sits at 50% by construction, so for anything with an
      // above-average record the mirror always read as its worst matchup —
      // an artifact of the arithmetic rather than anything about the brawler.
      prisma.$queryRaw<{ other: number; wins: bigint; decided: bigint }[]>`
        SELECT other_brawler_id AS other,
          COALESCE(SUM(battles) FILTER (WHERE result = 'victory'), 0) AS wins,
          SUM(battles) AS decided
        FROM brawler_pair_daily
        WHERE brawler_id = ${brawlerId} AND day >= ${since} AND side = 'enemy'
        GROUP BY other_brawler_id
        HAVING SUM(battles) >= ${MIN_SAMPLE_FOR_PAIRING}
      `,
      prisma.$queryRaw<{ other: number; wins: bigint; decided: bigint }[]>`
        SELECT other_brawler_id AS other,
          COALESCE(SUM(battles) FILTER (WHERE result = 'victory'), 0) AS wins,
          SUM(battles) AS decided
        FROM brawler_pair_daily
        WHERE brawler_id = ${brawlerId} AND day >= ${since} AND side = 'ally'
        GROUP BY other_brawler_id
        HAVING SUM(battles) >= ${MIN_SAMPLE_FOR_PAIRING}
      `,
    ]);

    const sampleSize = Number(totals[0]?.decided ?? 0);
    if (sampleSize < MIN_SAMPLE_FOR_PAIRING) return null;
    const baseline = Number(totals[0]?.wins ?? 0) / sampleSize;

    const toPairings = (rows: { other: number; wins: bigint; decided: bigint }[]) =>
      rows
        .map((row) => {
          const decided = Number(row.decided);
          const winRate = Number(row.wins) / decided;
          return {
            brawlerId: row.other,
            winRate,
            edge: winRate - baseline,
            decidedSampleSize: decided,
          };
        })
        // A pairing that lands on the brawler's own average is not a matchup,
        // it is the absence of one.
        .filter((p) => Math.abs(p.edge) >= 0.02);

    const versus = toPairings(enemies);
    const with_ = toPairings(allies);

    /*
     * Split by sign, not by sort order.
     *
     * Taking the best and worst of one list put the same matchup in both
     * columns whenever only one cleared the sample floor: Edgar's only pairing
     * showed as both his strongest and his weakest, at the same negative edge.
     * A favourable matchup is one he wins more than usual, so the sign decides
     * the column and a brawler can only ever appear in one.
     */
    return {
      baseline,
      sampleSize,
      strongAgainst: versus
        .filter((p) => p.edge > 0)
        .sort((a, b) => b.edge - a.edge)
        .slice(0, limit),
      weakAgainst: versus
        .filter((p) => p.edge < 0)
        .sort((a, b) => a.edge - b.edge)
        .slice(0, limit),
      bestWith: [...with_].sort((a, b) => b.edge - a.edge).slice(0, limit),
    };
  } catch (error) {
    swallow('compute_getBrawlerPairings', error);
    return null;
  }
}

/**
 * Battles a trio needs before it says anything.
 *
 * Forty, and the number was argued down to it rather than picked. At twenty,
 * 1,566 trios qualified and the top of every mode sat at 85-90% against a 66%
 * baseline — not a finding, but selection on noise: with thousands of
 * candidates at ~25 battles each, the maximum is extreme by construction.
 * Raising the floor is what makes the top of the list mean something; at forty
 * battles and fifteen distinct players the leaders are comps like one with 550
 * battles across 39 players at 84.5%, which is a real effect.
 *
 * The cost is coverage, and it is steep: 47 Brawl Ball comps survive, 6
 * Knockout, 4 Hot Zone, and nothing at all in five modes. Those modes say so
 * rather than showing a list built from noise.
 *
 * This loosens on its own. The 14-day window still mostly predates the pool
 * going from 1,000 players to 3,000 on 2026-08-30, so roughly a third of the
 * data it could hold is in it. Once the window is entirely post-change the
 * counts should roughly triple without anything here being touched.
 */
const MIN_SAMPLE_FOR_COMP = 40;

/**
 * How many DIFFERENT players must have used a comp before it counts.
 *
 * This is the one that matters, and it is not obvious. A trio of brawlers is a
 * proxy for a trio of *players*: three friends who queue together always bring
 * the same comp, so a strong premade team writes its own win rate into whatever
 * it happens to play. Measured over 14 days of Brawl Ball, win rate was almost
 * a pure function of how many distinct players a comp had:
 *
 *     1 player  -> 87.0%      5 players -> 81.6%
 *     2 players -> 80.9%     10 players -> 69.7%
 *     3 players -> 82.8%     12 players -> 64.0%
 *
 * The mode's own baseline over the same window is ~66%, so at ten distinct
 * players the effect has washed out and above it the numbers are about the
 * comp. Ranking on battles alone would have published a "best comps" page that
 * silently ranked which small groups of strong players exist — every entry at
 * a flat 100%, which is what gave it away.
 *
 * Fifteen rather than ten. Ten flattened the average to the mode baseline,
 * which is what the table above was measuring, but it did not fix the *top* of
 * the list: a comp with fourteen players can still be one player's twenty
 * battles plus thirteen people's one. Paired with the battle floor above,
 * fifteen is where the leaders stop being flukes.
 *
 * A within-player estimator was tried first — each player's rate with the comp
 * minus their own overall rate, which controls for skill exactly. It ranked the
 * same implausible comps at +20 to +30 points, because it does not address the
 * actual problem: selecting a maximum out of thousands of small samples. Sample
 * size was the fix, not a cleverer statistic.
 */
const MIN_DISTINCT_PLAYERS_FOR_COMP = 15;

/**
 * How far back comps read.
 *
 * Straight off the raw team rows rather than a roll-up, because a trio is not
 * a shape any roll-up keeps: `brawler_pair_daily` folds a battle into pairs and
 * `brawler_team_daily` folds it into single brawlers, and neither can be
 * reassembled into "these three, together". A fourth roll-up would mean a
 * migration and a new storage plateau to re-derive, for a query measured at
 * 935ms over 250k rows — which, cached for three hours, runs eight times a day.
 *
 * Bounded by RAW_BATTLE_RETENTION_DAYS in lib/aggregation, which is 14 and
 * deliberate. Under storage pressure the prune shortens that window, and this
 * thins out with it rather than breaking: fewer trios clear the floor, and the
 * page says so instead of inventing them.
 */
const COMP_WINDOW_DAYS = 14;

export interface TeamComp {
  /** Ascending, so the same three brawlers are always the same comp. */
  brawlerIds: number[];
  battles: number;
  /** Distinct players who used it — the sample size that actually matters. */
  players: number;
  winRate: number;
  /** 0.5 is the mode's own average, so a comp is judged against its mode. */
  normalizedWinRate: number | null;
  edge: number;
}

export interface ModeComps {
  mode: string;
  baseline: number;
  sampleSize: number;
  comps: TeamComp[];
}

/**
 * The trios that actually win, per mode.
 *
 * Measured against the mode rather than the roster, because modes do not share
 * a baseline — a comp that wins 54% of Heist matches has done something; the
 * same number in a mode the sample wins 54% of anyway has done nothing. The
 * mode's own rate is subtracted first, and `normalizeWinRate` then shrinks
 * toward it, so a 20-battle comp has to be genuinely better to outrank a
 * 200-battle one.
 *
 * Every mode is computed in one pass and cached together. Splitting it per
 * mode would repeat the same scan nine times for one page.
 *
 * Both Ranked and ladder count. Ladder is the larger half and its teams are
 * matched at random, which — for measuring whether three brawlers work
 * together — is a cleaner experiment than Ranked, where a good drafter picks
 * good comps and the two effects cannot be separated.
 */
async function compute_getTeamComps(limit = 12): Promise<ModeComps[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = windowStartUtc(COMP_WINDOW_DAYS);

    const [totals, trios] = await Promise.all([
      prisma.$queryRaw<{ mode: string; wins: bigint; decided: bigint }[]>`
        SELECT mode,
          COUNT(*) FILTER (WHERE result = 'victory') AS wins,
          COUNT(*) AS decided
        FROM battle_team_samples
        WHERE battle_time >= ${since}
          AND array_length(ally_brawler_ids, 1) = 2
          AND result IN ('victory', 'defeat')
        GROUP BY mode
      `,
      /*
       * `battle_key` is unique per row, so a battle contributes to a trio once
       * even when several of its players are in the sampled pool — checked,
       * because counting the same win three times would inflate exactly the
       * comps that are most popular among sampled players.
       */
      prisma.$queryRaw<
        { mode: string; trio: number[]; wins: bigint; decided: bigint; players: bigint }[]
      >`
        WITH teams AS (
          SELECT mode, player_tag,
            (SELECT array_agg(x ORDER BY x) FROM unnest(ally_brawler_ids || brawler_id) AS x) AS trio,
            result
          FROM battle_team_samples
          WHERE battle_time >= ${since}
            AND array_length(ally_brawler_ids, 1) = 2
            AND result IN ('victory', 'defeat')
        )
        SELECT mode, trio,
          COUNT(*) FILTER (WHERE result = 'victory') AS wins,
          COUNT(*) AS decided,
          COUNT(DISTINCT player_tag) AS players
        FROM teams
        GROUP BY mode, trio
        HAVING COUNT(*) >= ${MIN_SAMPLE_FOR_COMP}
           AND COUNT(DISTINCT player_tag) >= ${MIN_DISTINCT_PLAYERS_FOR_COMP}
      `,
    ]);

    const baselines = new Map(
      totals.map((row) => [
        row.mode,
        {
          baseline: Number(row.decided) > 0 ? Number(row.wins) / Number(row.decided) : 0.5,
          sampleSize: Number(row.decided),
        },
      ]),
    );

    const byMode = new Map<string, TeamComp[]>();
    for (const row of trios) {
      const base = baselines.get(row.mode);
      if (!base) continue;

      const battles = Number(row.decided);
      const winRate = Number(row.wins) / battles;
      const list = byMode.get(row.mode) ?? [];
      list.push({
        brawlerIds: row.trio,
        battles,
        players: Number(row.players),
        winRate,
        normalizedWinRate: normalizeWinRate(winRate, base.baseline, battles),
        edge: winRate - base.baseline,
      });
      byMode.set(row.mode, list);
    }

    return [...byMode.entries()]
      .map(([mode, comps]) => ({
        mode,
        baseline: baselines.get(mode)?.baseline ?? 0.5,
        sampleSize: baselines.get(mode)?.sampleSize ?? 0,
        comps: comps
          .sort((a, b) => (b.normalizedWinRate ?? 0) - (a.normalizedWinRate ?? 0))
          .slice(0, limit),
      }))
      // Most-played mode first: it is the one most readers came for.
      .sort((a, b) => b.sampleSize - a.sampleSize);
  } catch (error) {
    swallow('compute_getTeamComps', error);
    return [];
  }
}

export interface MapMatchup {
  brawlerId: number;
  againstBrawlerId: number;
  battles: number;
  winRate: number;
  /** Against the same brawler's record on this map, not its record overall. */
  edge: number;
}

/**
 * Which brawlers beat which, on a specific map.
 *
 * The site already answers "who is good on this map" and "who beats this
 * brawler". The gap between them is the question a draft actually asks: they
 * have picked Shelly and we are on Hard Rock Mine, so does Nita beat her *here*
 * — which is not the same as whether Nita beats her on average, because maps
 * decide engagement range and cover far more than the roster does.
 *
 * Measured against the brawler's own record on the same map, so a map that
 * simply favours a brawler does not make every one of its matchups look
 * winning. That is the whole reason the baseline is per-map rather than global.
 *
 * 1,725 map-matchup cells clear 40 battles across 131 maps — around thirteen a
 * map, which is a short honest list rather than a full grid. The grid would be
 * 11,000 cells per map and almost all of them empty.
 *
 * Every map is computed in one pass and cached together, for the same reason
 * comps are: the alternative is one full scan of the raw rows per map page.
 */
/*
 * Returns entries, not a Map.
 *
 * `unstable_cache` serialises what it stores, and a Map does not survive the
 * round trip — it comes back as a plain object, so the first (uncached) call
 * works and every later one throws `c.get is not a function`. That is a
 * genuinely nasty shape of bug: it passes every local test, passes the first
 * request after a deploy, and only breaks once the cache is warm.
 *
 * `getBestPicksByMode` already had the answer: cache the entries and rebuild
 * the Map outside the cache boundary.
 */
async function compute_getMapMatchups(limit = 8): Promise<[string, MapMatchup[]][]> {
  const prisma = getPrisma();
  const out = new Map<string, MapMatchup[]>();
  if (!prisma) return [];

  try {
    const since = windowStartUtc(COMP_WINDOW_DAYS);

    const rows = await prisma.$queryRaw<
      {
        map_name: string;
        a: number;
        b: number;
        wins: bigint;
        decided: bigint;
        base_wins: bigint;
        base_decided: bigint;
      }[]
    >`
      WITH faced AS (
        SELECT map_name, brawler_id AS a, unnest(enemy_brawler_ids) AS b,
          (result = 'victory')::int AS win
        FROM battle_team_samples
        WHERE battle_time >= ${since}
          AND map_name IS NOT NULL
          AND result IN ('victory', 'defeat')
      ),
      base AS (
        SELECT map_name, a, SUM(win) AS wins, COUNT(*) AS decided
        FROM faced GROUP BY map_name, a
      )
      SELECT f.map_name, f.a, f.b,
        SUM(f.win) AS wins, COUNT(*) AS decided,
        MAX(base.wins) AS base_wins, MAX(base.decided) AS base_decided
      FROM faced f
      JOIN base ON base.map_name = f.map_name AND base.a = f.a
      GROUP BY f.map_name, f.a, f.b
      HAVING COUNT(*) >= ${MIN_SAMPLE_FOR_COMP}
    `;

    for (const row of rows) {
      const decided = Number(row.decided);
      const baseDecided = Number(row.base_decided);
      if (decided === 0 || baseDecided === 0) continue;

      const winRate = Number(row.wins) / decided;
      const edge = winRate - Number(row.base_wins) / baseDecided;
      // A matchup that lands on the brawler's own map average is not a matchup.
      if (Math.abs(edge) < 0.05) continue;

      const list = out.get(row.map_name) ?? [];
      list.push({
        brawlerId: row.a,
        againstBrawlerId: row.b,
        battles: decided,
        winRate,
        edge,
      });
      out.set(row.map_name, list);
    }

    /*
     * Balanced by sign rather than ranked by magnitude.
     *
     * Sorting on |edge| alone filled every map with losing matchups — the bad
     * ones are simply more extreme — so the list told a drafter what not to do
     * and never what to do. Taking each end separately guarantees both, and
     * the merge leaves the whole list running best to worst.
     */
    const half = Math.max(1, Math.floor(limit / 2));
    for (const [map, list] of out) {
      const sorted = [...list].sort((x, y) => y.edge - x.edge);
      const best = sorted.slice(0, half);
      const worst = sorted.slice(-half).filter((m) => !best.includes(m));
      out.set(map, [...best, ...worst].sort((x, y) => y.edge - x.edge));
    }

    return [...out];
  } catch (error) {
    swallow('compute_getMapMatchups', error);
    return [...out];
  }
}

export type DiscoveryKind =
  | 'secret-pick'
  | 'meta-trap'
  | 'giant-killer'
  | 'secret-duo'
  | 'map-surprise'
  | 'overnight-rise';

export interface Discovery {
  kind: DiscoveryKind;
  /** One or two brawlers, in reading order: the subject first. */
  brawlerIds: number[];
  brawlerNames: string[];
  /** The number the discovery is about — a win rate, or a delta in points. */
  value: number;
  /** What that number is measured against. */
  comparison: number;
  sampleSize: number;
  /** A map or mode name, where the finding is specific to one. */
  context?: string;
  href: string;
}

/** A pairing needs far more evidence than a comp: it is picked, not drafted. */
const MIN_SAMPLE_FOR_DISCOVERY = 300;

/** Enough that a "nobody plays this" claim is about the roster, not the tail. */
const SECRET_PICK_MAX_USAGE = 0.01;

/**
 * Six findings a reader would not get from a ranked table.
 *
 * The site is full of sorted lists, and a sorted list answers "who is best"
 * while hiding everything interesting: the brawler winning quietly at 0.4%
 * usage, the popular pick that loses, the matchup that is not close. Each of
 * these is a *contrast* — a number against the number it should have been —
 * and a table cannot show a contrast without the reader doing the subtraction.
 *
 * Deterministic, not generated. Every one is the argmax of a stated quantity
 * over a stated population, so the same data always produces the same six, and
 * the page can be regenerated from scratch without drifting.
 *
 * Each returns null rather than a weak entry when nothing clears its floor,
 * and the page renders what it gets. A day with four discoveries shows four.
 */
async function compute_getDailyDiscoveries(): Promise<Discovery[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const [index, movers, mapPicks] = await Promise.all([
      getMetaIndex('ranked', 7).catch(() => new Map<number, ScoredBrawler>()),
      getMetaMovers(1).catch(() => [] as MetaMover[]),
      getRankedMapPicks(6).catch(() => [] as RankedMapPicks[]),
    ]);

    const scored = [...index.values()].filter(
      (b) => b.normalizedWinRate !== null && b.decidedSampleSize >= MIN_SAMPLE_FOR_DISCOVERY,
    );
    const nameOf = (id: number) => index.get(id)?.brawlerName ?? `#${id}`;
    const out: Discovery[] = [];

    /*
     * 1. Winning quietly: the best record among brawlers almost nobody picks —
     *    excluding whatever the tier list is already shouting about.
     *
     * The meta score deliberately rewards a strong record at low usage, so its
     * top entries are often exactly the brawlers this would pick. The first
     * version named Amber, which is true (0.78% usage) and useless: Amber was
     * also rank 1 on the tier list. A secret the front page already tells you
     * is not a secret, so the top of the ranking is off the table.
     */
    const headline = new Set(
      [...scored]
        .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
        .slice(0, 10)
        .map((b) => b.brawlerId),
    );
    const secret = scored
      .filter((b) => (b.usageRate ?? 1) <= SECRET_PICK_MAX_USAGE && !headline.has(b.brawlerId))
      .sort((a, b) => (b.normalizedWinRate ?? 0) - (a.normalizedWinRate ?? 0))[0];
    if (secret && (secret.normalizedWinRate ?? 0) > 0.52) {
      out.push({
        kind: 'secret-pick',
        brawlerIds: [secret.brawlerId],
        brawlerNames: [secret.brawlerName],
        value: secret.normalizedWinRate ?? 0,
        comparison: secret.usageRate ?? 0,
        sampleSize: secret.decidedSampleSize,
        href: brawlerPath(secret.brawlerId, secret.brawlerName),
      });
    }

    // 2. The inverse: heavily picked and losing. Ranked by usage, not by how
    //    badly it loses — a popular trap is more interesting than a bad one.
    const trap = scored
      .filter((b) => (b.normalizedWinRate ?? 1) < 0.485)
      .sort((a, b) => (b.usageRate ?? 0) - (a.usageRate ?? 0))[0];
    if (trap && (trap.usageRate ?? 0) > 0.02) {
      out.push({
        kind: 'meta-trap',
        brawlerIds: [trap.brawlerId],
        brawlerNames: [trap.brawlerName],
        value: trap.normalizedWinRate ?? 0,
        comparison: trap.usageRate ?? 0,
        sampleSize: trap.decidedSampleSize,
        href: brawlerPath(trap.brawlerId, trap.brawlerName),
      });
    }

    // 3 and 4. The most one-sided matchup, and the best partnership, from the
    //    same roll-up — each measured against the subject's own overall record
    //    so a strong brawler does not simply own both lists.
    const pairSince = windowStartUtc(14);
    const [pairs, pairBaselines] = await Promise.all([
      prisma.$queryRaw<{ side: string; a: number; b: number; wins: bigint; decided: bigint }[]>`
        SELECT side, brawler_id AS a, other_brawler_id AS b,
          COALESCE(SUM(battles) FILTER (WHERE result = 'victory'), 0) AS wins,
          SUM(battles) AS decided
        FROM brawler_pair_daily
        WHERE day >= ${pairSince}
        GROUP BY side, brawler_id, other_brawler_id
        HAVING SUM(battles) >= ${MIN_SAMPLE_FOR_DISCOVERY}
      `,
      /*
       * The baseline has to come from the same place over the same window.
       *
       * The first version measured these pairings against the brawler's Ranked
       * form from `getMetaIndex` — a different format over a different number
       * of days, since `brawler_pair_daily` is rolled up from every battle type
       * and read here over fourteen. Every edge came out inflated, and
       * plausibly so: +30 points looks like a discovery rather than a units
       * mismatch. `brawler_team_daily` is the same roll-up of the same battles,
       * which is why getBrawlerPairings uses it too.
       */
      prisma.$queryRaw<{ id: number; wins: bigint; decided: bigint }[]>`
        SELECT brawler_id AS id, SUM(wins) AS wins, SUM(decided) AS decided
        FROM brawler_team_daily
        WHERE day >= ${pairSince}
        GROUP BY brawler_id
      `,
    ]);

    const baselineFor = new Map(
      pairBaselines
        .filter((row) => Number(row.decided) > 0)
        .map((row) => [row.id, Number(row.wins) / Number(row.decided)]),
    );

    const edgeOf = (row: { a: number; wins: bigint; decided: bigint }) => {
      const own = baselineFor.get(row.a);
      if (own === undefined) return null;
      return Number(row.wins) / Number(row.decided) - own;
    };

    const best = (side: string, kind: DiscoveryKind) => {
      let top: { row: (typeof pairs)[number]; edge: number } | null = null;
      for (const row of pairs) {
        if (row.side !== side) continue;
        const edge = edgeOf(row);
        if (edge === null) continue;
        if (!top || edge > top.edge) top = { row, edge };
      }
      if (!top || top.edge < 0.05) return;
      out.push({
        kind,
        brawlerIds: [top.row.a, top.row.b],
        brawlerNames: [nameOf(top.row.a), nameOf(top.row.b)],
        value: Number(top.row.wins) / Number(top.row.decided),
        comparison: baselineFor.get(top.row.a) ?? 0.5,
        sampleSize: Number(top.row.decided),
        href: brawlerPath(top.row.a, nameOf(top.row.a)),
      });
    };
    best('enemy', 'giant-killer');
    best('ally', 'secret-duo');

    // 5. A brawler that behaves differently on one map than it does anywhere
    //    else — the largest gap between its map score and its overall form.
    let surprise: { pick: RankedMapPick; map: RankedMapPicks; edge: number } | null = null;
    for (const map of mapPicks) {
      for (const pick of map.picks) {
        const edge = pick.score - pick.overallScore;
        if (pick.decidedSampleSize < 60) continue;
        if (!surprise || edge > surprise.edge) surprise = { pick, map, edge };
      }
    }
    if (surprise && surprise.edge > 0.03) {
      out.push({
        kind: 'map-surprise',
        brawlerIds: [surprise.pick.brawlerId],
        brawlerNames: [surprise.pick.brawlerName],
        value: surprise.pick.score,
        comparison: surprise.pick.overallScore,
        sampleSize: surprise.pick.decidedSampleSize,
        context: surprise.map.mapName,
        href: `/maps/${slugify(surprise.map.mode)}/${slugify(surprise.map.mapName)}`,
      });
    }

    // 6. Yesterday against today, on the same score the tier list ranks.
    const risen = movers
      .filter((m) => m.sampleSize >= MIN_SAMPLE_FOR_DISCOVERY)
      .sort((a, b) => b.metaScoreDelta - a.metaScoreDelta)[0];
    if (risen && risen.metaScoreDelta > 0.2) {
      out.push({
        kind: 'overnight-rise',
        brawlerIds: [risen.brawlerId],
        brawlerNames: [risen.brawlerName],
        value: risen.metaScoreNow,
        comparison: risen.metaScoreBefore,
        sampleSize: risen.sampleSize,
        href: brawlerPath(risen.brawlerId, risen.brawlerName),
      });
    }

    return out;
  } catch (error) {
    swallow('compute_getDailyDiscoveries', error);
    return [];
  }
}


/** How a brawler does against a specific set of opponents. */
export interface CounterScore {
  brawlerId: number;
  /**
   * Win rate across the named opponents, weighted by how often each was faced.
   *
   * Previously "the rate in battles where at least one of them was present",
   * counting such a battle once. The pairing roll-up counts per pairing, so a
   * battle against two of the named opponents now contributes twice — once per
   * matchup. That makes this a per-matchup average rather than a per-battle
   * one, which is the more useful reading for a draft anyway: facing two of
   * the enemy's picks is two matchups, and weighting it as one understated it.
   */
  winRate: number;
  /** That rate minus the brawler's own overall rate in the same window. */
  edge: number;
  decidedSampleSize: number;
}

/**
 * Every brawler's record against a given enemy line-up, in two queries.
 *
 * The draft helper needs this for the whole roster at once, which is why it is
 * one grouped query over an array overlap rather than a head-to-head lookup per
 * candidate — that would be a hundred round trips per draft.
 *
 * Reported as an edge against the brawler's own overall rate, so a brawler that
 * simply wins a lot does not appear to counter everything.
 */
export function getCounterScores(
  enemyIds: number[],
  windowDays = 21,
): Promise<Map<number, CounterScore>> {
  return pairingScores(enemyIds, 'enemy', windowDays);
}

/**
 * The same measurement from the other side: how a brawler does *alongside* a
 * given line-up rather than against it.
 *
 * A Ranked draft alternates picks, so by the time you choose you usually know
 * some of your own team as well as some of theirs — and the two questions have
 * different answers. A brawler can counter the enemy's comp and still be a poor
 * fit beside your own. The roll-up already stores both sides (`side = 'ally'`
 * comes from `allyBrawlerIds`), so this costs nothing new to collect.
 *
 * Same edge semantics: the rate alongside those brawlers minus the brawler's
 * own overall rate, so a brawler that simply wins a lot does not appear to
 * synergise with everything.
 */
export function getAllyScores(
  allyIds: number[],
  windowDays = 21,
): Promise<Map<number, CounterScore>> {
  return pairingScores(allyIds, 'ally', windowDays);
}

async function pairingScores(
  otherIds: number[],
  side: 'enemy' | 'ally',
  windowDays: number,
): Promise<Map<number, CounterScore>> {
  const out = new Map<number, CounterScore>();
  const prisma = getPrisma();
  if (!prisma || otherIds.length === 0) return out;

  try {
    const since = windowStartUtc(windowDays);

    const [overall, versus] = await Promise.all([
      prisma.$queryRaw<{ brawler_id: number; wins: bigint; decided: bigint }[]>`
        SELECT brawler_id,
          COALESCE(SUM(wins), 0) AS wins,
          COALESCE(SUM(decided), 0) AS decided
        FROM brawler_team_daily
        WHERE day >= ${since}
        GROUP BY brawler_id
      `,
      // One row per (brawler, opponent) pairing, summed over the named
      // opponents. See CounterScore.winRate: a battle against two of them
      // lands in two pairings and so is counted twice, deliberately.
      prisma.$queryRaw<{ brawler_id: number; wins: bigint; decided: bigint }[]>`
        SELECT brawler_id,
          COALESCE(SUM(battles) FILTER (WHERE result = 'victory'), 0) AS wins,
          SUM(battles) AS decided
        FROM brawler_pair_daily
        WHERE day >= ${since}
          AND side = ${side}
          AND other_brawler_id = ANY(${otherIds}::int[])
        GROUP BY brawler_id
        HAVING SUM(battles) >= ${MIN_SAMPLE_FOR_PAIRING}
      `,
    ]);

    const base = new Map(
      overall.map((row) => [
        row.brawler_id,
        Number(row.decided) > 0 ? Number(row.wins) / Number(row.decided) : null,
      ]),
    );

    for (const row of versus) {
      const decided = Number(row.decided);
      const winRate = Number(row.wins) / decided;
      const own = base.get(row.brawler_id);
      if (own === null || own === undefined) continue;

      out.set(row.brawler_id, {
        brawlerId: row.brawler_id,
        winRate,
        edge: winRate - own,
        decidedSampleSize: decided,
      });
    }

    return out;
  } catch (error) {
    swallow('pairingScores', error);
    return out;
  }
}

/** One brawler's record against one specific other brawler. */
export interface HeadToHead {
  winRate: number;
  decidedSampleSize: number;
}

/**
 * How brawler A does with brawler B on the other team.
 *
 * Separate from `getBrawlerPairings` because that one only publishes pairings
 * far enough from the brawler's own average to be worth calling a matchup. A
 * comparison page asks about one specific pair, and "these two are even" is a
 * real answer there.
 */
export async function getHeadToHead(
  brawlerId: number,
  opponentId: number,
  windowDays = 21,
): Promise<HeadToHead | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const since = windowStartUtc(windowDays);
    const rows = await prisma.$queryRaw<{ wins: bigint; decided: bigint }[]>`
      SELECT
        COALESCE(SUM(battles) FILTER (WHERE result = 'victory'), 0) AS wins,
        COALESCE(SUM(battles), 0) AS decided
      FROM brawler_pair_daily
      WHERE brawler_id = ${brawlerId}
        AND day >= ${since}
        AND side = 'enemy'
        AND other_brawler_id = ${opponentId}
    `;

    const decided = Number(rows[0]?.decided ?? 0);
    if (decided < MIN_SAMPLE_FOR_PAIRING) return null;
    return { winRate: Number(rows[0]?.wins ?? 0) / decided, decidedSampleSize: decided };
  } catch (error) {
    swallow('getHeadToHead', error);
    return null;
  }
}

/**
 * Minimum decided battles a brawler needs *on this map* before it can be
 * listed.
 *
 * This is an eligibility gate, not a confidence gate. Its only job is to keep
 * the list drawn from brawlers actually played here rather than from the
 * roster at large; the estimate itself is what handles thin evidence, by
 * shrinking toward the brawler's overall ranked form (see below).
 *
 * Raised from 4 to 8 because 4 was letting a four-battle record take the top
 * row of a map — a coin flip wearing a percentage sign, and the first thing a
 * reader sees. Shrinkage kept the *number* honest but not the *ordering*.
 *
 * 8 costs nothing today: measured over the current 21-day window, all 27
 * sampled maps still field at least three eligible brawlers at 8 (the
 * thinnest, Undermine, has four), while 12 would empty half of them. Worth
 * re-measuring with the same query if the sampling rate changes.
 */
const MIN_SAMPLE_FOR_MAP_PICK = 8;

/** Maps needing at least this many decided battles to appear at all. */
const MIN_SAMPLE_FOR_MAP = 20;

/**
 * How far back the per-map ranking looks.
 *
 * Longer than the tier lists' seven days, and deliberately so: a map ranking is
 * the most thinly-evidenced number on the site — competitive Ranked is under a
 * fifth of what gets sampled, and that fifth is then split across ~27 maps and
 * the whole roster. Widening the window is the one lever that thickens it
 * without another API call, and the Ranked map rotation barely moves inside
 * three weeks, so the extra days describe the same maps rather than stale ones.
 *
 * Bounded by ROLLUP_RETENTION_DAYS (30) in `lib/aggregation`, which is what
 * actually limits how far this can go. The raw battles are gone long before
 * that; what this window reads is `battle_daily_stats`.
 */
export const RANKED_MAP_WINDOW_DAYS = 21;

/**
 * How recently a map must have been played to count as in rotation.
 *
 * The window above is three weeks, but the Ranked map pool is set per season
 * and does change — so a window that deep can outlive a rotation and leave
 * retired maps sitting on the board with numbers nobody can act on. This is
 * the guard: depth of evidence from the full window, membership from the last
 * few days only.
 *
 * Four days rather than one, because it has to survive a quiet sampling day.
 * The pool is only sampled a few hundred players at a time and a map with a
 * thin slot can genuinely go a day without appearing; dropping it for that
 * would flicker the board.
 */
export const MAP_ROTATION_GRACE_DAYS = 4;

/**
 * Strength of the map-level prior, in pseudo-battles.
 *
 * Deliberately large relative to the four-to-nine battles a brawler actually
 * has on one map: at n=5 roughly five sixths of the estimate is still the
 * brawler's overall form, which is the correct weighting when five battles is
 * all the evidence there is. As a map fills in, its own record takes over.
 */
const MAP_PRIOR_BATTLES = 25;

/** Decided battles at which a map's own ranking starts carrying real weight. */
const MAP_CONFIDENCE_MEDIUM = 60;
const MAP_CONFIDENCE_HIGH = 150;

function mapConfidence(decided: number): MapConfidence {
  if (decided >= MAP_CONFIDENCE_HIGH) return 'high';
  if (decided >= MAP_CONFIDENCE_MEDIUM) return 'medium';
  return 'low';
}

/**
 * Best brawlers per map, from competitive (Ranked) battles only.
 *
 * Map is recorded per battle sample, so this can only see battles collected
 * after that column was added. Rows without a map are excluded rather than
 * bucketed into an "unknown map", which would quietly poison every ranking.
 *
 * Two things make a per-map ranking different from the per-mode one, and both
 * were getting it wrong before:
 *
 * 1. **The baseline is sample-wide, not per-map.** Ranked matchmaking is
 *    symmetric, so the true average win rate is the same on every map — any
 *    difference between maps is our sampling, not the map. Measured over the
 *    current window the per-map figures ranged from 27% to 71% on forty-odd
 *    battles each, while the sample as a whole sat at 53.6% over 5,231. Scoring
 *    against the per-map number meant subtracting noise: on a map whose sample
 *    happened to read 27%, a brawler losing two games in three cleared the bar
 *    and was published as the map's best pick. Every map is now scored against
 *    the one sample-wide baseline.
 *
 * 2. **The prior is the brawler, not the population.** Splitting by map leaves
 *    each brawler four to nine decided battles. Shrinking that toward the
 *    population mean throws away the most informative thing we know — how the
 *    brawler performs in Ranked generally — and leaves the ordering to
 *    whichever coin flips landed. So the estimate is hierarchical: the
 *    brawler's overall ranked record is itself shrunk toward the sample
 *    baseline, and the map's handful of battles are then shrunk toward *that*.
 *    A brawler needs to beat its own form on this map to rise above itself.
 *
 * A pick is only published if it comes out above the baseline. Ranking within
 * a thin list is one thing; presenting a below-average brawler as a "best
 * pick" is simply wrong, and is what the empty state exists for.
 */
async function computeRankedMapPicks(
  perMap = 3,
  windowDays = RANKED_MAP_WINDOW_DAYS,
  /**
   * Narrows the map half of the query to one map, for its own page. The
   * per-brawler prior is deliberately left unfiltered: it is the brawler's
   * form across all of Ranked, which is exactly what a single map's handful of
   * battles has to be weighed against.
   */
  only?: { mapName: string; mode?: string },
): Promise<RankedMapPicks[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = windowStartUtc(windowDays);
    const competitive = {
      day: { gte: since },
      battleType: { in: [...COMPETITIVE_BATTLE_TYPES] },
    };

    // Two groupings, one round trip. The first is every ranked battle in the
    // window regardless of map — it is what the per-brawler prior is built
    // from, and it deliberately includes rows sampled before map recording
    // started, since a prior wants all the evidence it can get.
    const [overallGroups, mapGroups] = await Promise.all([
      prisma.battleDailyStat.groupBy({
        by: ['brawlerId', 'result'],
        where: competitive,
        _sum: { battles: true },
      }),
      prisma.battleDailyStat.groupBy({
        by: ['mapName', 'eventId', 'mode', 'brawlerId', 'brawlerName', 'result'],
        where: {
          ...competitive,
          mapName: only ? only.mapName : { not: null },
          ...(only?.mode ? { mode: only.mode } : {}),
        },
        _sum: { battles: true },
        // Newest battle per group, folded up per map below: this is what says
        // whether the map is still in the rotation or just still in the window.
        // The roll-up carries the real battle timestamp, not the day it was
        // filed under, so the rotation cut-off keeps its original precision.
        _max: { lastBattleTime: true },
      }),
    ]);

    // Ranked is 3v3 only, so `result` is always victory/defeat/draw here and
    // the showdown placement handling the per-mode picks need does not apply.
    let sampleWins = 0;
    let sampleDecided = 0;
    const overall = new Map<number, { wins: number; decided: number }>();

    for (const g of overallGroups) {
      if (g.result !== 'victory' && g.result !== 'defeat') continue;
      const n = g._sum.battles ?? 0;
      const acc = overall.get(g.brawlerId) ?? { wins: 0, decided: 0 };
      acc.decided += n;
      sampleDecided += n;
      if (g.result === 'victory') {
        acc.wins += n;
        sampleWins += n;
      }
      overall.set(g.brawlerId, acc);
    }

    if (sampleDecided === 0) return [];
    const baseline = sampleWins / sampleDecided;
    const rotationCutoff = Date.now() - MAP_ROTATION_GRACE_DAYS * 86_400_000;

    /** The brawler's overall ranked form, shrunk toward the sample baseline. */
    function priorFor(brawlerId: number): { rate: number; decided: number } {
      const acc = overall.get(brawlerId);
      if (!acc || acc.decided === 0) return { rate: baseline, decided: 0 };
      return {
        rate:
          (acc.wins + baseline * PRIOR_BATTLES) / (acc.decided + PRIOR_BATTLES),
        decided: acc.decided,
      };
    }

    type Acc = { name: string; wins: number; decided: number; total: number };
    type MapAcc = {
      mapName: string;
      eventId: number | null;
      mode: string;
      /** Newest sampled battle on this map, for the rotation check. */
      lastSeen: number;
      brawlers: Map<number, Acc>;
    };
    const byMap = new Map<string, MapAcc>();

    for (const g of mapGroups) {
      if (!g.mapName) continue;
      const key = `${g.mapName}::${g.mode}`;
      const entry =
        byMap.get(key) ??
        {
          mapName: g.mapName,
          eventId: g.eventId,
          mode: g.mode,
          lastSeen: 0,
          brawlers: new Map<number, Acc>(),
        };
      const seen = g._max.lastBattleTime?.getTime() ?? 0;
      if (seen > entry.lastSeen) entry.lastSeen = seen;
      // Artwork is keyed on the event id, so never let a null row overwrite a
      // real one just because it was grouped first.
      if (entry.eventId === null && g.eventId !== null) entry.eventId = g.eventId;

      const acc =
        entry.brawlers.get(g.brawlerId) ??
        { name: g.brawlerName, wins: 0, decided: 0, total: 0 };
      const n = g._sum.battles ?? 0;

      if (g.result === 'victory') {
        acc.wins += n;
        acc.decided += n;
      } else if (g.result === 'defeat') {
        acc.decided += n;
      }

      acc.total += n;
      entry.brawlers.set(g.brawlerId, acc);
      byMap.set(key, entry);
    }

    const out: RankedMapPicks[] = [];

    for (const entry of byMap.values()) {
      let mapWins = 0;
      let mapDecided = 0;
      let mapTotal = 0;
      for (const acc of entry.brawlers.values()) {
        mapWins += acc.wins;
        mapDecided += acc.decided;
        mapTotal += acc.total;
      }
      if (!only && mapDecided < MIN_SAMPLE_FOR_MAP) continue;
      // Out of rotation: its numbers are real but they describe a map nobody
      // can queue for, which is worse than showing nothing. Dropped from the
      // board; a single-map request still gets the row, so the map's own page
      // can say *why* it has no current ranking rather than implying the
      // sample is thin.
      if (!only && entry.lastSeen < rotationCutoff) continue;

      const picks: RankedMapPick[] = [...entry.brawlers]
        .filter(([, acc]) => acc.decided >= MIN_SAMPLE_FOR_MAP_PICK)
        .map(([brawlerId, acc]) => {
          const prior = priorFor(brawlerId);
          const raw = acc.decided > 0 ? acc.wins / acc.decided : 0;
          const estimate =
            (acc.wins + prior.rate * MAP_PRIOR_BATTLES) /
            (acc.decided + MAP_PRIOR_BATTLES);

          return {
            brawlerId,
            brawlerName: acc.name,
            winRate: raw,
            pickRate: mapTotal > 0 ? acc.total / mapTotal : 0,
            decidedSampleSize: acc.decided,
            score: clampRate(estimate - baseline + 0.5),
            overallScore: clampRate(prior.rate - baseline + 0.5),
            overallSampleSize: prior.decided,
          };
        })
        // Above the sample baseline or it is not a "best pick" at all.
        .filter((p) => p.score > 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, perMap);

      out.push({
        mapName: entry.mapName,
        eventId: entry.eventId,
        mode: entry.mode,
        picks,
        sampleSize: mapDecided,
        baselineWinRate: baseline,
        mapWinRate: mapDecided > 0 ? mapWins / mapDecided : 0,
        confidence: mapConfidence(mapDecided),
        brawlersSeen: entry.brawlers.size,
        lastSeen: new Date(entry.lastSeen).toISOString(),
      });
    }

    // Maps that can say something come first, then the best-sampled of the
    // rest. A map with no qualifying pick is still worth a card: it names what
    // is in the rotation and shows how far along its sample is.
    return out.sort((a, b) => {
      if ((a.picks.length > 0) !== (b.picks.length > 0)) {
        return a.picks.length > 0 ? -1 : 1;
      }
      return b.sampleSize - a.sampleSize;
    });
  } catch (error) {
    swallow('computeRankedMapPicks', error);
    return [];
  }
}

/* ---------------------------- indexable pairings --------------------------- */

/**
 * How many brawlers, by pick rate, are popular enough for their pairings to be
 * worth indexing.
 *
 * The bound is popularity rather than sample size, and that is the whole
 * point. Measured 2026-08-24, *every* one of the 5,565 possible pairings had
 * been sampled and 4,601 cleared MIN_SAMPLE_FOR_PAIRING — so gating on
 * evidence bounds nothing, and indexing on it would have multiplied the site's
 * crawlable surface roughly eightfold. Each of those is a server-rendered page
 * that queries the database, which is exactly what put public network transfer
 * on course to overrun its allowance in the first place.
 *
 * What actually varies is demand: people search "shelly vs colt", not
 * "gus vs buzz". Pick rate is the closest proxy the data has for that, and it
 * is self-limiting — the top 30 yields at most 435 pairings, a surface the
 * crawl budget can absorb.
 */
const PAIR_INDEX_TOP_BRAWLERS = 30;

/**
 * The pairings worth letting search engines index.
 *
 * One source of truth for two callers that must agree: the sitemap lists these,
 * and `/compare/[pair]` marks exactly these `index`. A page in the sitemap that
 * says `noindex`, or an indexable page absent from the sitemap, are both
 * contradictions a crawler has to spend budget resolving.
 *
 * Returns unordered pairs of brawler ids; the route turns them into slugs.
 */
async function computeIndexablePairs(): Promise<[number, number][]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = windowStartUtc(RANKED_MAP_WINDOW_DAYS);

    // Popularity first, so the pairing query only considers a bounded set.
    const popular = await prisma.battleDailyStat.groupBy({
      by: ['brawlerId'],
      where: { day: { gte: since } },
      _sum: { battles: true },
      orderBy: { _sum: { battles: 'desc' } },
      take: PAIR_INDEX_TOP_BRAWLERS,
    });
    const ids = popular.map((row) => row.brawlerId);
    if (ids.length < 2) return [];

    // Both sides popular, and the pairing itself actually measured. `LEAST`
    // and `GREATEST` collapse the two directions into one unordered pair, so a
    // comparison yields a single URL rather than two that mirror each other.
    const rows = await prisma.$queryRaw<{ a: number; b: number }[]>`
      SELECT LEAST(brawler_id, other_brawler_id) AS a,
             GREATEST(brawler_id, other_brawler_id) AS b
      FROM brawler_pair_daily
      WHERE side = 'enemy'
        AND day >= ${since}
        AND brawler_id = ANY(${ids}::int[])
        AND other_brawler_id = ANY(${ids}::int[])
      GROUP BY 1, 2
      HAVING SUM(battles) >= ${MIN_SAMPLE_FOR_PAIRING}
    `;

    return rows.map((row) => [row.a, row.b] as [number, number]);
  } catch (error) {
    swallow('computeIndexablePairs', error);
    return [];
  }
}

/* ------------------------------ cached reads ------------------------------ */

/**
 * Wraps a read so many renders share one query.
 *
 * Generic because there are two dozen of these and hand-writing a wrapper each
 * time is how half of them end up uncached. The cache key is the supplied
 * name plus the call arguments, so one entry exists per distinct set of
 * arguments — 106 for a per-brawler read, one for a global one.
 *
 * Deliberately NOT applied to anything keyed by player tag
 * (`getTrophyHistory`, `getTrophyPercentile`, `getPlayerBrawlerPlacements`).
 * Those answer "how am *I* doing", the person asking has usually just played,
 * and serving them an hour-old answer to save bytes is the wrong trade — their
 * pages are `noindex` and barely crawled, so they are not what costs anything.
 */
function cachedRead<A extends unknown[], R>(
  key: string,
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  const wrapped = unstable_cache(
    fn as (...args: unknown[]) => Promise<R>,
    [key],
    { revalidate: READ_CACHE_SECONDS },
  );
  return async (...args: A) => {
    try {
      return await wrapped(...(args as unknown[]));
    } catch (error) {
      /*
       * Outside a Next server context there is no incremental cache, and
       * `unstable_cache` throws an invariant rather than degrading — so every
       * read in this file explodes the moment a plain script imports it. Same
       * family as needing `--conditions=react-server` for `server-only`, and
       * just as invisible: `tsc`, eslint and `next build` all pass, because
       * none of them run the script.
       *
       * It cost a Discord bot that reported "nothing moved" every day while
       * actually failing on every call, because the caller wrapped this in a
       * `.catch` that returned an empty list. Running uncached is exactly
       * right for a script: it runs once and exits, so there is nothing for a
       * cache to amortise.
       *
       * Matched on the specific invariant, never broadly — a real database
       * error must still reach the caller rather than being retried silently
       * and then swallowed a second time.
       */
      if (error instanceof Error && error.message.includes('incrementalCache missing')) {
        return fn(...args);
      }
      throw error;
    }
  };
}


/*
 * The four reads that dominate database egress, wrapped so that many renders
 * share one query. See READ_CACHE_SECONDS for the measurement behind this.
 *
 * Wrapped at the export rather than at each call site: these are read from
 * pages, opengraph images and the sitemap, and a cache that only some callers
 * remember to use is not a cache. The `compute*` functions above stay
 * uncached and unexported, so there is exactly one way to reach them.
 */

const cachedBestPicksByMode = unstable_cache(
  // `unstable_cache` serialises through JSON, and a Map does not survive that
  // — it would come back as `{}`. Entries go in and out instead, and the Map
  // is rebuilt on this side so callers see no difference.
  async (perMode: number, windowDays: number) => [
    ...(await computeBestPicksByMode(perMode, windowDays)),
  ],
  ['best-picks-by-mode'],
  { revalidate: READ_CACHE_SECONDS },
);

/**
 * Best picks per mode. Identical for every map page in a mode, which is what
 * makes this the single biggest saving: one query an hour instead of one per
 * map render.
 */
export async function getBestPicksByMode(
  perMode = 3,
  windowDays = 7,
): Promise<Map<string, ModeBestPicks>> {
  return new Map(await cachedBestPicksByMode(perMode, windowDays));
}

const cachedBrawlerStatsForWindow = unstable_cache(
  async (windowDays: number, mode: string | undefined, format: TierFormat) =>
    computeBrawlerStatsForWindow(windowDays, mode, format),
  ['brawler-stats-for-window'],
  { revalidate: READ_CACHE_SECONDS },
);

export async function getBrawlerStatsForWindow(
  windowDays: number,
  mode?: string,
  format: TierFormat = 'ranked',
): Promise<BrawlerStatRow[]> {
  return cachedBrawlerStatsForWindow(windowDays, mode, format);
}

const cachedFilterableModes = unstable_cache(
  async (windowDays: number, minBattles: number, format: TierFormat) =>
    computeFilterableModes(windowDays, minBattles, format),
  ['filterable-modes'],
  { revalidate: READ_CACHE_SECONDS },
);

export async function getFilterableModes(
  windowDays = 21,
  minBattles = 150,
  format: TierFormat = 'ranked',
): Promise<{ mode: string; battles: number }[]> {
  return cachedFilterableModes(windowDays, minBattles, format);
}

const cachedRankedMapPicks = unstable_cache(
  async (
    perMap: number,
    windowDays: number,
    only: { mapName: string; mode?: string } | undefined,
  ) => computeRankedMapPicks(perMap, windowDays, only),
  ['ranked-map-picks'],
  { revalidate: READ_CACHE_SECONDS },
);

/**
 * When each Ranked map was last played, ignoring the rotation cut-off.
 *
 * `getRankedMapPicks` drops a map once it has gone `MAP_ROTATION_GRACE_DAYS`
 * without a sighting, which is right for a board that claims to show the
 * current rotation. The cost is that the page then cannot tell two very
 * different situations apart: a map that has never been sampled, and one the
 * game rotated out days ago.
 *
 * They read identically on screen and only one of them is going to change.
 * Measured 2026-08-31: the season pool listed 30 maps, 26 of which were played
 * every day, while Crystal Arcade, Pit Stop, Safe(r) Zone and Rustic Arcade
 * stopped appearing between the 25th and the 26th. All four still showed "no
 * sampled battles yet", which promises data that is not coming.
 *
 * Carries the event id too, which is the only way to show artwork for a map
 * that has left every rotation. The page normally takes art from the active
 * map catalogue, and that catalogue only lists what is currently live — so
 * Safe(r) Zone, out of Ranked *and* off the ladder, rendered with no picture
 * and no link while the other three retired maps kept theirs. Brawlify's map
 * data is keyed by event id and does include retired maps, so our own battle
 * history is enough to find it again.
 *
 * Keyed on mode and map exactly as the roll-up stores them; callers slugify.
 */
export async function getRankedMapLastSeen(
  windowDays = RANKED_MAP_WINDOW_DAYS,
): Promise<{ mode: string; mapName: string; lastSeen: string; eventId: number | null }[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const rows = await prisma.battleDailyStat.groupBy({
      by: ['mode', 'mapName', 'eventId'],
      where: {
        battleType: { in: [...COMPETITIVE_BATTLE_TYPES] },
        day: { gte: windowStartUtc(windowDays) },
        mapName: { not: null },
      },
      _max: { lastBattleTime: true },
    });

    // Grouping by event id splits a map across however many ids it has been
    // filed under, so fold back to one row each and keep the most recent.
    const byMap = new Map<string, { mode: string; mapName: string; lastSeen: string; eventId: number | null }>();
    for (const row of rows) {
      const seen = row._max.lastBattleTime;
      if (!row.mapName || !seen) continue;
      const key = `${row.mode}|${row.mapName}`;
      const iso = seen.toISOString();
      const held = byMap.get(key);
      if (!held || iso > held.lastSeen) {
        byMap.set(key, { mode: row.mode, mapName: row.mapName, lastSeen: iso, eventId: row.eventId });
      }
    }
    return [...byMap.values()];
  } catch (error) {
    swallow('getRankedMapLastSeen', error);
    return [];
  }
}

/* --------------------------- role compositions ---------------------------- */

/**
 * How the shapes of a team perform, by role rather than by brawler.
 *
 * The sample stores both teams of every competitive battle, and until now only
 * pairs were ever read from it. Identity-level trios are not supportable and
 * will not be soon: there are ~187,000 possible three-brawler teams against
 * 166,720 sampled battles, so the average trio has been seen ten times and
 * exactly one has passed fifty. Measured 2026-08-31.
 *
 * Roles collapse that. There are seven classes, so ~120 distinct shapes, and
 * 76 of them clear 200 battles — enough for a number that means something.
 * This is the level the data actually supports, and it happens to be the level
 * a drafter thinks at: nobody asks whether Brock-Piper-Poco wins, they ask
 * whether two marksmen and a support wins.
 *
 * Baseline-adjusted, and that matters more here than anywhere else on the
 * site. Every comp's raw win rate sits above 50% because each battle is
 * counted from a sampled player's point of view and sampled players are
 * stronger than average — so read raw, a 56% comp looks good while actually
 * being below the sample's own average. `normalizeWinRate` re-centres on the
 * baseline, so 50% here means "exactly average for this sample" and the
 * numbers are comparable with the tier list rather than merely adjacent to it.
 */

/** Below this a comp's rate is noise dressed as a finding. */
const MIN_BATTLES_FOR_COMP = 200;

export interface RoleComposition {
  /** The three roles, alphabetical, so one shape has one key. */
  roles: string[];
  /** Baseline-adjusted: 0.5 is exactly average for the sample. */
  score: number;
  /** Raw share of decided battles won, before adjustment. */
  winRate: number;
  decided: number;
}

async function compute_getRoleCompositions(
  windowDays = RANKED_MAP_WINDOW_DAYS,
): Promise<{ comps: RoleComposition[]; baseline: number } | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const [catalog, rows] = await Promise.all([
      getBrawlerCatalog().catch(() => null),
      prisma.$queryRaw<{ comp: number[]; result: string; n: bigint }[]>`
        SELECT (SELECT array_agg(x ORDER BY x)
                FROM unnest(brawler_id || ally_brawler_ids) x) AS comp,
               result,
               count(*) AS n
        FROM battle_team_samples
        WHERE battle_type = ANY(${[...COMPETITIVE_BATTLE_TYPES]}::text[])
          AND array_length(ally_brawler_ids, 1) = 2
          AND result IN ('victory', 'defeat')
          AND battle_time >= ${windowStartUtc(windowDays)}
        GROUP BY 1, 2
      `,
    ]);
    if (!catalog || rows.length === 0) return null;

    const roleOf = new Map(catalog.all.map((b) => [b.id, b.className]));

    const byShape = new Map<string, { roles: string[]; wins: number; decided: number }>();
    let wins = 0;
    let decided = 0;

    for (const row of rows) {
      // A brawler with no class would make the shape a lie rather than a
      // guess, so the whole battle is skipped.
      const roles = row.comp.map((id) => roleOf.get(id) ?? null);
      if (roles.some((r) => r === null)) continue;

      const key = (roles as string[]).slice().sort().join(' + ');
      const n = Number(row.n);
      const entry = byShape.get(key) ?? { roles: key.split(' + '), wins: 0, decided: 0 };
      entry.decided += n;
      decided += n;
      if (row.result === 'victory') {
        entry.wins += n;
        wins += n;
      }
      byShape.set(key, entry);
    }

    if (decided === 0) return null;
    const baseline = wins / decided;

    const comps = [...byShape.values()]
      .filter((c) => c.decided >= MIN_BATTLES_FOR_COMP)
      .map((c) => {
        const raw = c.wins / c.decided;
        return {
          roles: c.roles,
          score: normalizeWinRate(raw, baseline, c.decided) ?? 0.5,
          winRate: raw,
          decided: c.decided,
        };
      })
      .sort((a, b) => b.score - a.score);

    return { comps, baseline };
  } catch (error) {
    swallow('compute_getRoleCompositions', error);
    return null;
  }
}

export const getRoleCompositions = cachedRead('role-compositions', compute_getRoleCompositions);

export async function getRankedMapPicks(
  perMap = 3,
  windowDays = RANKED_MAP_WINDOW_DAYS,
  only?: { mapName: string; mode?: string },
): Promise<RankedMapPicks[]> {
  return cachedRankedMapPicks(perMap, windowDays, only);
}

/* The reads above, cached. See `cachedRead`. */
export const getBrawlerSplits = cachedRead('brawler-splits', compute_getBrawlerSplits);
export const getBrawlerPairings = cachedRead('brawler-pairings', compute_getBrawlerPairings);
export const getTeamComps = cachedRead('team-comps', compute_getTeamComps);

/** A brawler's record on one ladder map, against that map's own average. */
export interface MapForm {
  brawlerId: number;
  battles: number;
  winRate: number;
  /** 0.5 is the map's average, so maps with different pools stay comparable. */
  adjusted: number;
}

/** Below this a map-and-brawler cell is noise; shrinkage handles the rest. */
const MIN_SAMPLE_FOR_MAP_FORM = 30;

/**
 * Every brawler's form on every ladder map, keyed by map name.
 *
 * Ladder rather than Ranked, deliberately: this exists to answer "what should I
 * press play with to gain trophies", and trophies are a ladder currency. It is
 * also the larger sample by some distance — 103 maps and 442k decided battles
 * in the last week against 28 maps in Ranked.
 *
 * Measured against each map's own baseline. Maps do not share a win rate: a
 * mode where the sampled pool wins 62% and one where it wins 68% would rank
 * their brawlers against each other rather than against their own map, and the
 * ranking would mostly reproduce the mode list.
 *
 * Computed for all maps at once and cached, because the caller wants roughly
 * fifteen of them — one per live rotation slot — and fifteen separate scans of
 * the roll-up would cost far more than one.
 */
async function compute_getLadderMapForm(
  windowDays = 14,
): Promise<[string, MapForm[]][]> {
  const prisma = getPrisma();
  const out = new Map<string, MapForm[]>();
  if (!prisma) return [];

  try {
    const rows = await prisma.$queryRaw<
      { map_name: string; brawler_id: number; wins: bigint; decided: bigint }[]
    >`
      SELECT map_name, brawler_id,
        COALESCE(SUM(battles) FILTER (WHERE result = 'victory'), 0) AS wins,
        SUM(battles) AS decided
      FROM battle_daily_stats
      WHERE battle_type = 'ranked'
        AND day >= ${windowStartUtc(windowDays)}
        AND map_name IS NOT NULL
        AND result IN ('victory', 'defeat')
      GROUP BY map_name, brawler_id
      HAVING SUM(battles) >= ${MIN_SAMPLE_FOR_MAP_FORM}
    `;

    const totals = new Map<string, { wins: number; decided: number }>();
    for (const row of rows) {
      const t = totals.get(row.map_name) ?? { wins: 0, decided: 0 };
      t.wins += Number(row.wins);
      t.decided += Number(row.decided);
      totals.set(row.map_name, t);
    }

    for (const row of rows) {
      const total = totals.get(row.map_name);
      if (!total || total.decided === 0) continue;

      const battles = Number(row.decided);
      const winRate = Number(row.wins) / battles;
      const list = out.get(row.map_name) ?? [];
      list.push({
        brawlerId: row.brawler_id,
        battles,
        winRate,
        adjusted: normalizeWinRate(winRate, total.wins / total.decided, battles) ?? 0.5,
      });
      out.set(row.map_name, list);
    }

    for (const [map, list] of out) {
      out.set(map, list.sort((a, b) => b.adjusted - a.adjusted));
    }
    return [...out];
  } catch (error) {
    swallow('compute_getLadderMapForm', error);
    return [...out];
  }
}

const cachedMapMatchups = cachedRead('map-matchups', compute_getMapMatchups);

/** Keyed by map name. See compute_getMapMatchups for why the cache holds entries. */
export async function getMapMatchups(): Promise<Map<string, MapMatchup[]>> {
  return new Map(await cachedMapMatchups());
}
const cachedLadderMapForm = cachedRead('ladder-map-form', compute_getLadderMapForm);

/** Keyed by map name. Entries through the cache, Map to callers. */
export async function getLadderMapForm(): Promise<Map<string, MapForm[]>> {
  return new Map(await cachedLadderMapForm());
}
export const getDailyDiscoveries = cachedRead('daily-discoveries', compute_getDailyDiscoveries);
export const getBrawlerTrend = cachedRead('brawler-trend', compute_getBrawlerTrend);
export const getBrawlerBuffies = cachedRead('brawler-buffies', compute_getBrawlerBuffies);
export const getBrawlerAbilityChoices = cachedRead('brawler-ability-choices', compute_getBrawlerAbilityChoices);
export const getLatestBrawlerStats = cachedRead('latest-brawler-stats', compute_getLatestBrawlerStats);
export const getBrawlerStat = cachedRead('brawler-stat', compute_getBrawlerStat);
export const getMetaMovers = cachedRead('meta-movers', compute_getMetaMovers);
export const getCoverageStats = cachedRead('coverage-stats', compute_getCoverageStats);
export const getTrophyGains = cachedRead('trophy-gains', compute_getTrophyGains);
export const getSkinUsage = cachedRead('skin-usage', compute_getSkinUsage);
export const getSkinCatalogue = cachedRead('skin-catalogue', compute_getSkinCatalogue);
export const getIconCatalogue = cachedRead('icon-catalogue', compute_getIconCatalogue);
export const getBrawlerSkins = cachedRead('brawler-skins', compute_getBrawlerSkins);
export const getIconUsage = cachedRead('icon-usage', compute_getIconUsage);
export const getReleasedBuffieCount = cachedRead('released-buffie-count', compute_getReleasedBuffieCount);
export const getRankedLeaderboard = cachedRead('ranked-leaderboard', compute_getRankedLeaderboard);
export const getCatalogChanges = cachedRead('catalog-changes', compute_getCatalogChanges);
export const getIndexablePairs = cachedRead('indexable-pairs', computeIndexablePairs);
