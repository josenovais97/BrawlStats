import 'server-only';

import type { BrawlerStat as BrawlerStatModel } from '@/generated/prisma/client';
import { stripGameMarkup } from '@/lib/format';
import { getPrisma } from '@/lib/prisma';
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
export async function getLatestBrawlerStats(): Promise<BrawlerStatRow[]> {
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
  } catch {
    // A missing table or an unreachable database must not break the page.
    return [];
  }
}

/** Latest aggregated row for a single brawler, or null if there is none. */
export async function getBrawlerStat(brawlerId: number): Promise<BrawlerStatRow | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const row = await prisma.brawlerStat.findFirst({
      where: { brawlerId },
      orderBy: { snapshotDate: 'desc' },
    });
    return row ? toStatRow(row) : null;
  } catch {
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
export async function getMetaMovers(lookbackDays = 7): Promise<MetaMover[]> {
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
  } catch {
    return [];
  }
}

/** Most recent detected catalogue changes, newest first. */
export async function getCatalogChanges(limit = 40): Promise<CatalogChangeEntry[]> {
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
  } catch {
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
  } catch {
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
  } catch {
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
  } catch {
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
export async function getReleasedBuffieCount(): Promise<number | null> {
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
  } catch {
    return null;
  }
}

export interface CoverageStats {
  brawlers: number;
  players: number;
  battles: number;
  placements: number;
}

/**
 * Headline counts for the landing page.
 *
 * Real numbers rather than invented ones — if the database is empty the
 * homepage falls back to the brawler count alone rather than showing zeroes.
 */
export async function getCoverageStats(): Promise<CoverageStats | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    // Sequential so the page never needs more than one connection.
    const players = await prisma.sampledPlayer.count();
    const battles = await prisma.battleSample.count();
    const placements = await prisma.brawlerRankingEntry.count();
    const brawlers = await prisma.brawlerCatalogEntry.findMany({
      distinct: ['brawlerId'],
      select: { brawlerId: true },
    });

    return {
      brawlers: brawlers.length,
      players,
      battles,
      placements,
    };
  } catch {
    return null;
  }
}

/** Most recent cron run, used to show data freshness on the tier list. */
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
  } catch {
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
  } catch {
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
  } catch {
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
export async function getTrophyGains(limit = 10): Promise<TrophyGain[]> {
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
  } catch {
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
export async function getBestPicksByMode(
  perMode = 3,
  windowDays = 7,
): Promise<Map<string, ModeBestPicks>> {
  const prisma = getPrisma();
  const out = new Map<string, ModeBestPicks>();
  if (!prisma) return out;

  try {
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const where = { battleTime: { gte: since } };

    // `rank` is in the grouping so showdown placements can be folded into
    // wins and losses; it is null for every mode that reports a result.
    const [rankedGroups, allGroups] = await Promise.all([
      prisma.battleSample.groupBy({
        by: ['mode', 'brawlerId', 'brawlerName', 'result', 'rank'],
        where: { ...where, battleType: { in: [...COMPETITIVE_BATTLE_TYPES] } },
        _count: { _all: true },
      }),
      prisma.battleSample.groupBy({
        by: ['mode', 'brawlerId', 'brawlerName', 'result', 'rank'],
        where,
        _count: { _all: true },
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
        const n = g._count._all;
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
  } catch {
    return out;
  }
}

/** Windows the tier list can be viewed over. */
export const TIER_WINDOWS = {
  '24h': { days: 1, label: 'Meta', sublabel: '24h' },
  '7d': { days: 7, label: 'Recent', sublabel: '7d' },
  '30d': { days: 30, label: 'General', sublabel: '30d' },
} as const;

export type TierWindowKey = keyof typeof TIER_WINDOWS;

export function isTierWindow(value: string | undefined): value is TierWindowKey {
  return value !== undefined && value in TIER_WINDOWS;
}

/**
 * Recomputes brawler win and pick rates over an arbitrary window, straight from
 * `battle_samples`, for one tier-list format.
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
export async function getBrawlerStatsForWindow(
  windowDays: number,
  mode?: string,
  format: TierFormat = 'ranked',
): Promise<BrawlerStatRow[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const scope = {
      battleTime: { gte: since },
      battleType: battleTypeFilter(format),
      ...(mode ? { mode } : {}),
    };

    // `mode` and `rank` are grouped so showdown placements can be folded into
    // wins and losses, and so each mode can be scored against its own
    // baseline. Both are only load-bearing on the trophy side; Ranked is 3v3
    // throughout, where `rank` is always null and the modes sit within a point
    // or two of each other.
    const [allGroups, resultGroups, totalBattles] = await Promise.all([
      prisma.battleSample.groupBy({
        by: ['brawlerId', 'brawlerName'],
        where: scope,
        _count: { _all: true },
      }),
      prisma.battleSample.groupBy({
        by: ['brawlerId', 'brawlerName', 'result', 'rank', 'mode'],
        where: scope,
        _count: { _all: true },
      }),
      prisma.battleSample.count({ where: scope }),
    ]);

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
      const count = group._count._all;
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
      allGroups.map((g) => [g.brawlerId, { name: g.brawlerName, total: g._count._all }]),
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
  } catch {
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
export async function getMetaIndex(
  format: TierFormat = 'ranked',
  windowDays = 7,
): Promise<Map<number, ScoredBrawler>> {
  const rows = await getBrawlerStatsForWindow(windowDays, undefined, format);
  return new Map(scoreBrawlers(rows, format).map((entry) => [entry.brawlerId, entry]));
}

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
export async function getRankedLeaderboard(
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
  } catch {
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
export async function getSkinUsage(limit = 20): Promise<CosmeticUsage[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = new Date(Date.now() - COSMETIC_WINDOW_DAYS * 86_400_000);

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
  } catch {
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
export async function getIconUsage(limit = 12): Promise<CosmeticUsage[]> {
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
  } catch {
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
export async function getFilterableModes(
  windowDays = 30,
  minBattles = 150,
  format: TierFormat = 'ranked',
): Promise<{ mode: string; battles: number }[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const groups = await prisma.battleSample.groupBy({
      by: ['mode'],
      where: { battleTime: { gte: since }, battleType: battleTypeFilter(format) },
      _count: { _all: true },
    });

    return groups
      .map((g) => ({ mode: g.mode, battles: g._count._all }))
      .filter((m) => m.battles >= minBattles)
      .sort((a, b) => b.battles - a.battles);
  } catch {
    return [];
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

export async function getBrawlerBuffies(
  brawlerId: number,
  windowDays = 7,
): Promise<BrawlerBuffies | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const since = new Date(Date.now() - windowDays * 86_400_000);

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
  } catch {
    return null;
  }
}

/**
 * Share of sampled owners who have unlocked this brawler's hypercharge.
 *
 * Returns null rather than zero when nobody has one recorded, because the two
 * are genuinely different and only one of them is a fact: hypercharge
 * ownership started being recorded later than the rest of the loadout, so a
 * flat zero usually means "measured before we tracked it", not "nobody owns
 * it". Guarding on that is what keeps a newly added column from printing 0% on
 * every brawler for a day.
 *
 * Unlike a buffie, this one is worth a percentage: a hypercharge is bought and
 * plenty of owners have not, so the share says something about the brawler's
 * investment curve rather than about how long the feature has existed.
 */
export async function getHyperChargeOwnership(
  brawlerId: number,
  windowDays = 7,
): Promise<number | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const since = new Date(Date.now() - windowDays * 86_400_000);

    // One vote per player, from their most recent snapshot — matching how
    // buffies and skins are counted.
    const rows = await prisma.$queryRaw<{ owners: bigint; with_hyper: bigint }[]>`
      WITH latest AS (
        SELECT DISTINCT ON (player_tag) player_tag, hyper_charge_ids
        FROM player_brawler_snapshots
        WHERE brawler_id = ${brawlerId} AND snapshot_date >= ${since}
        ORDER BY player_tag, snapshot_date DESC
      )
      SELECT COUNT(*) AS owners,
             COUNT(*) FILTER (WHERE cardinality(hyper_charge_ids) > 0) AS with_hyper
      FROM latest
    `;

    const owners = Number(rows[0]?.owners ?? 0);
    const withHyper = Number(rows[0]?.with_hyper ?? 0);
    if (owners === 0 || withHyper === 0) return null;

    return withHyper / owners;
  } catch {
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
export async function getBrawlerSplits(
  brawlerId: number,
  windowDays = 14,
): Promise<{ modes: BrawlerSplit[]; maps: BrawlerSplit[] }> {
  const prisma = getPrisma();
  const empty = { modes: [], maps: [] };
  if (!prisma) return empty;

  try {
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const where = { battleTime: { gte: since } };

    // Both groupings cover every brawler, not just this one: the averages each
    // slice is scored against have to come from the whole population, or a
    // brawler would be measured against itself.
    const [modeGroups, mapGroups] = await Promise.all([
      prisma.battleSample.groupBy({
        by: ['mode', 'brawlerId', 'result', 'rank'],
        where,
        _count: { _all: true },
      }),
      prisma.battleSample.groupBy({
        by: ['mode', 'mapName', 'eventId', 'brawlerId', 'result', 'rank'],
        where: { ...where, mapName: { not: null } },
        _count: { _all: true },
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
    function fold<G extends { mode: string; brawlerId: number; result: string; rank: number | null; _count: { _all: number } }>(
      groups: G[],
      keyOf: (g: G) => string,
    ) {
      const mine = new Map<string, Tally>();
      const all = new Map<string, Tally>();

      for (const g of groups) {
        const n = g._count._all;
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
  } catch {
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
export async function getBrawlerTrend(
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
  } catch {
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
 * Reads `battle_team_samples`, which stores one row per battle from the
 * sampled player's perspective — so a pairing is counted once, from one side,
 * and never enters the usage or win-rate aggregates that `battle_samples`
 * feeds. The id arrays are expanded with `unnest`, which is why this is raw
 * SQL rather than a `groupBy`.
 *
 * Every rate is reported as an edge against the brawler's own average in the
 * same sample, not as an absolute. A brawler that wins 58% of everything is
 * not "strong against" the opponent it wins 55% against, and the absolute
 * number would say it was.
 */
export async function getBrawlerPairings(
  brawlerId: number,
  windowDays = 21,
  limit = 5,
): Promise<BrawlerPairings | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const since = new Date(Date.now() - windowDays * 86_400_000);

    const [totals, enemies, allies] = await Promise.all([
      prisma.$queryRaw<{ wins: bigint; decided: bigint }[]>`
        SELECT
          COUNT(*) FILTER (WHERE result = 'victory') AS wins,
          COUNT(*) AS decided
        FROM battle_team_samples
        WHERE brawler_id = ${brawlerId} AND battle_time >= ${since}
      `,
      prisma.$queryRaw<{ other: number; wins: bigint; decided: bigint }[]>`
        SELECT other,
          COUNT(*) FILTER (WHERE result = 'victory') AS wins,
          COUNT(*) AS decided
        FROM battle_team_samples, unnest(enemy_brawler_ids) AS other
        WHERE brawler_id = ${brawlerId} AND battle_time >= ${since}
        GROUP BY other
        HAVING COUNT(*) >= ${MIN_SAMPLE_FOR_PAIRING}
      `,
      prisma.$queryRaw<{ other: number; wins: bigint; decided: bigint }[]>`
        SELECT other,
          COUNT(*) FILTER (WHERE result = 'victory') AS wins,
          COUNT(*) AS decided
        FROM battle_team_samples, unnest(ally_brawler_ids) AS other
        WHERE brawler_id = ${brawlerId} AND battle_time >= ${since}
        GROUP BY other
        HAVING COUNT(*) >= ${MIN_SAMPLE_FOR_PAIRING}
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

    return {
      baseline,
      sampleSize,
      strongAgainst: [...versus].sort((a, b) => b.edge - a.edge).slice(0, limit),
      weakAgainst: [...versus].sort((a, b) => a.edge - b.edge).slice(0, limit),
      bestWith: [...with_].sort((a, b) => b.edge - a.edge).slice(0, limit),
    };
  } catch {
    return null;
  }
}

/** How a brawler does against a specific set of opponents. */
export interface CounterScore {
  brawlerId: number;
  /** Win rate when at least one of the named opponents was on the other team. */
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
export async function getCounterScores(
  enemyIds: number[],
  windowDays = 21,
): Promise<Map<number, CounterScore>> {
  const out = new Map<number, CounterScore>();
  const prisma = getPrisma();
  if (!prisma || enemyIds.length === 0) return out;

  try {
    const since = new Date(Date.now() - windowDays * 86_400_000);

    const [overall, versus] = await Promise.all([
      prisma.$queryRaw<{ brawler_id: number; wins: bigint; decided: bigint }[]>`
        SELECT brawler_id,
          COUNT(*) FILTER (WHERE result = 'victory') AS wins,
          COUNT(*) AS decided
        FROM battle_team_samples
        WHERE battle_time >= ${since}
        GROUP BY brawler_id
      `,
      prisma.$queryRaw<{ brawler_id: number; wins: bigint; decided: bigint }[]>`
        SELECT brawler_id,
          COUNT(*) FILTER (WHERE result = 'victory') AS wins,
          COUNT(*) AS decided
        FROM battle_team_samples
        WHERE battle_time >= ${since}
          AND enemy_brawler_ids && ${enemyIds}::int[]
        GROUP BY brawler_id
        HAVING COUNT(*) >= ${MIN_SAMPLE_FOR_PAIRING}
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
  } catch {
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
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const rows = await prisma.$queryRaw<{ wins: bigint; decided: bigint }[]>`
      SELECT
        COUNT(*) FILTER (WHERE result = 'victory') AS wins,
        COUNT(*) AS decided
      FROM battle_team_samples
      WHERE brawler_id = ${brawlerId}
        AND battle_time >= ${since}
        AND ${opponentId} = ANY(enemy_brawler_ids)
    `;

    const decided = Number(rows[0]?.decided ?? 0);
    if (decided < MIN_SAMPLE_FOR_PAIRING) return null;
    return { winRate: Number(rows[0]?.wins ?? 0) / decided, decidedSampleSize: decided };
  } catch {
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
 * Bounded by BATTLE_RETENTION_DAYS (35) in `lib/aggregation`, which is what
 * actually limits how far this can go.
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
export async function getRankedMapPicks(
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
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const competitive = {
      battleTime: { gte: since },
      battleType: { in: [...COMPETITIVE_BATTLE_TYPES] },
    };

    // Two groupings, one round trip. The first is every ranked battle in the
    // window regardless of map — it is what the per-brawler prior is built
    // from, and it deliberately includes rows sampled before map recording
    // started, since a prior wants all the evidence it can get.
    const [overallGroups, mapGroups] = await Promise.all([
      prisma.battleSample.groupBy({
        by: ['brawlerId', 'result'],
        where: competitive,
        _count: { _all: true },
      }),
      prisma.battleSample.groupBy({
        by: ['mapName', 'eventId', 'mode', 'brawlerId', 'brawlerName', 'result'],
        where: {
          ...competitive,
          mapName: only ? only.mapName : { not: null },
          ...(only?.mode ? { mode: only.mode } : {}),
        },
        _count: { _all: true },
        // Newest battle per group, folded up per map below: this is what says
        // whether the map is still in the rotation or just still in the window.
        _max: { battleTime: true },
      }),
    ]);

    // Ranked is 3v3 only, so `result` is always victory/defeat/draw here and
    // the showdown placement handling the per-mode picks need does not apply.
    let sampleWins = 0;
    let sampleDecided = 0;
    const overall = new Map<number, { wins: number; decided: number }>();

    for (const g of overallGroups) {
      if (g.result !== 'victory' && g.result !== 'defeat') continue;
      const n = g._count._all;
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
      const seen = g._max.battleTime?.getTime() ?? 0;
      if (seen > entry.lastSeen) entry.lastSeen = seen;
      // Artwork is keyed on the event id, so never let a null row overwrite a
      // real one just because it was grouped first.
      if (entry.eventId === null && g.eventId !== null) entry.eventId = g.eventId;

      const acc =
        entry.brawlers.get(g.brawlerId) ??
        { name: g.brawlerName, wins: 0, decided: 0, total: 0 };
      const n = g._count._all;

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
  } catch {
    return [];
  }
}
