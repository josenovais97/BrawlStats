import 'server-only';

import type { BrawlerStat as BrawlerStatModel } from '@/generated/prisma/client';
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

/** Pick rate mapping to 0-1. Anchored absolutely so scores stay comparable
 *  between windows and modes rather than being rescaled by whoever is present. */
const PICK_FLOOR = 0.001; // 0.1% -> 0
const PICK_CEILING = 0.05; // 5%   -> 1

/** Adjusted win rate mapping to 0-1. The band is where real separation lives. */
const WIN_FLOOR = 0.42;
const WIN_CEILING = 0.6;

/** Performance carries most of the weight; popularity breaks the ties. */
const WIN_WEIGHT = 0.65;
const PICK_WEIGHT = 0.35;

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

export function metaScore(
  normalizedWinRate: number | null,
  usageRate: number | null,
): number | null {
  if (normalizedWinRate === null) return null;

  const win = clamp01((normalizedWinRate - WIN_FLOOR) / (WIN_CEILING - WIN_FLOOR));

  const pick =
    usageRate && usageRate > 0
      ? clamp01(
          (Math.log10(usageRate) - Math.log10(PICK_FLOOR)) /
            (Math.log10(PICK_CEILING) - Math.log10(PICK_FLOOR)),
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

export const TIER_ORDER: Tier[] = ['S', 'A', 'B', 'C', 'D'];

export const TIER_COLOR: Record<Tier, string> = {
  S: '#ff5c72',
  A: '#ff9f45',
  B: '#ffc53d',
  C: '#7ad97a',
  D: '#7fb3ff',
};

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
 * Brawlers whose adjusted win rate moved most between the latest snapshot and
 * the closest one at least `lookbackDays` old.
 *
 * Both sides are baseline-adjusted before comparison. Without that a shift in
 * who happened to get sampled would masquerade as a balance change.
 */
export async function getMetaMovers(lookbackDays = 7): Promise<MetaMover[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const latest = await prisma.brawlerStat.findFirst({
      orderBy: { snapshotDate: 'desc' },
      select: { snapshotDate: true },
    });
    if (!latest) return [];

    const cutoff = new Date(latest.snapshotDate);
    cutoff.setUTCDate(cutoff.getUTCDate() - lookbackDays);

    // Nearest snapshot at or before the cutoff; falls back to the oldest one
    // available so a young dataset still shows movement.
    const earlier =
      (await prisma.brawlerStat.findFirst({
        where: { snapshotDate: { lte: cutoff } },
        orderBy: { snapshotDate: 'desc' },
        select: { snapshotDate: true },
      })) ??
      (await prisma.brawlerStat.findFirst({
        where: { snapshotDate: { lt: latest.snapshotDate } },
        orderBy: { snapshotDate: 'asc' },
        select: { snapshotDate: true },
      }));

    if (!earlier) return [];

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

      movers.push({
        brawlerId: row.brawlerId,
        brawlerName: row.brawlerName,
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

    return movers.sort((a, b) => Math.abs(b.winRateDelta) - Math.abs(a.winRateDelta));
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
export async function recordLookup(tag: string, name?: string, trophies?: number) {
  const prisma = getPrisma();
  if (!prisma) return;

  try {
    await prisma.sampledPlayer.upsert({
      where: { tag },
      create: { tag, name, trophies, source: 'lookup' },
      update: { name, trophies },
    });
  } catch {
    // Intentionally silent.
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
    const names = new Map(named.map((n) => [n.tag, n.name]));

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
 * `battle_samples`.
 *
 * The cron writes one precomputed row per brawler per day at a fixed 7-day
 * window, which is what the homepage and brawler pages read. The tier list
 * needs three windows side by side, and storing three rows per brawler per day
 * would mean widening the table's unique key. Recomputing instead is a single
 * grouped query over a table in the tens of thousands of rows, and the page
 * that calls it revalidates hourly, so it runs about once an hour.
 *
 * Deliberately mirrors `recomputeBrawlerStats`: competitive battles for the win
 * rate, every battle for the pick rate, one baseline across the window.
 */
export async function getBrawlerStatsForWindow(
  windowDays: number,
  mode?: string,
): Promise<BrawlerStatRow[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const scope = mode ? { battleTime: { gte: since }, mode } : { battleTime: { gte: since } };

    // `rank` is grouped so showdown placements can be folded into wins and
    // losses; it is null for every mode that reports a result.
    const [allGroups, rankedGroups, totalBattles] = await Promise.all([
      prisma.battleSample.groupBy({
        by: ['brawlerId', 'brawlerName'],
        where: scope,
        _count: { _all: true },
      }),
      prisma.battleSample.groupBy({
        by: ['brawlerId', 'brawlerName', 'result', 'rank', 'mode'],
        where: { ...scope, battleType: { in: [...COMPETITIVE_BATTLE_TYPES] } },
        _count: { _all: true },
      }),
      prisma.battleSample.count({ where: scope }),
    ]);

    // Showdown is never played in competitive Ranked, so a showdown-only view
    // has to read every battle or it would always be empty.
    const groups =
      rankedGroups.length === 0 && mode
        ? await prisma.battleSample.groupBy({
            by: ['brawlerId', 'brawlerName', 'result', 'rank', 'mode'],
            where: scope,
            _count: { _all: true },
          })
        : rankedGroups;

    const ranked = new Map<number, { name: string; wins: number; losses: number }>();
    for (const g of groups) {
      const acc = ranked.get(g.brawlerId) ?? { name: g.brawlerName, wins: 0, losses: 0 };
      const winRank = SHOWDOWN_WIN_RANK[g.mode];
      if (g.result === 'victory') acc.wins += g._count._all;
      else if (g.result === 'defeat') acc.losses += g._count._all;
      else if (g.result === 'rank' && winRank !== undefined && g.rank !== null) {
        if (g.rank <= winRank) acc.wins += g._count._all;
        else acc.losses += g._count._all;
      }
      ranked.set(g.brawlerId, acc);
    }

    let popWins = 0;
    let popDecided = 0;
    for (const acc of ranked.values()) {
      popWins += acc.wins;
      popDecided += acc.wins + acc.losses;
    }
    const baselineWinRate = popDecided > 0 ? popWins / popDecided : null;

    const usage = new Map(
      allGroups.map((g) => [g.brawlerId, { name: g.brawlerName, total: g._count._all }]),
    );
    const ids = new Set([...usage.keys(), ...ranked.keys()]);
    const snapshotDate = toIsoDate(new Date());

    return [...ids].map((brawlerId) => {
      const all = usage.get(brawlerId);
      const comp = ranked.get(brawlerId);
      const decided = comp ? comp.wins + comp.losses : 0;

      return {
        brawlerId,
        brawlerName: all?.name ?? comp?.name ?? `Brawler ${brawlerId}`,
        snapshotDate,
        winRate: decided > 0 ? comp!.wins / decided : null,
        baselineWinRate,
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
 * Modes with enough sampled battles to be worth offering as a tier-list filter,
 * most-played first. Returned from the data rather than hard-coded so a mode
 * leaving rotation drops out on its own.
 */
export async function getFilterableModes(
  windowDays = 30,
  minBattles = 150,
): Promise<{ mode: string; battles: number }[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const groups = await prisma.battleSample.groupBy({
      by: ['mode'],
      where: { battleTime: { gte: since } },
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

/**
 * Minimum decided battles a brawler needs *on this map* before it can be
 * listed.
 *
 * This is an eligibility gate, not a confidence gate. Its only job is to keep
 * the list drawn from brawlers actually played here rather than from the
 * roster at large; the estimate itself is what handles thin evidence, by
 * shrinking toward the brawler's overall ranked form (see below).
 */
const MIN_SAMPLE_FOR_MAP_PICK = 4;

/** Maps needing at least this many decided battles to appear at all. */
const MIN_SAMPLE_FOR_MAP = 20;

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
  windowDays = 14,
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
        where: { ...competitive, mapName: { not: null } },
        _count: { _all: true },
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
          brawlers: new Map<number, Acc>(),
        };
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
      if (mapDecided < MIN_SAMPLE_FOR_MAP) continue;

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
