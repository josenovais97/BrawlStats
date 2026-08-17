import 'server-only';

import {
  getBattleLog,
  getBrawlerRankings,
  getClub,
  getClubRankings,
  getOfficialBrawlers,
  getPlayer,
  getPlayerRankings,
} from '@/lib/bs-api';
import { snapshotAndDiffCatalog } from '@/lib/catalog';
import { BrawlApiError, toApiError } from '@/lib/errors';
import { getPrisma } from '@/lib/prisma';
import { normalizeTag } from '@/lib/tags';
import { parseApiDate } from '@/lib/format';
import type { BSBattleLogEntry, BSBattlePlayer } from '@/types/brawlstars';

/**
 * Write side of the tier-list pipeline, driven by the daily cron job.
 *
 * One run does three things:
 *   1. tops up the pool of player tags to sample from,
 *   2. samples a slice of that pool (least-recently-sampled first),
 *   3. recomputes today's `brawler_stats` row for every brawler seen in the
 *      trailing window.
 *
 * Sizing note: each sampled player costs two API calls (profile + battle log),
 * so the defaults below are deliberately conservative. See the README for how
 * to grow the sample honestly.
 */

/**
 * Players sampled per run. 2 API calls each.
 *
 * This is an upper bound, not a target: sampling stops at `samplingDeadline`
 * regardless, so a slow upstream night simply samples fewer players rather
 * than overrunning the function. Sized so a healthy run finishes in roughly
 * half the budget, which keeps Active CPU well inside the Hobby allowance.
 */
const DEFAULT_BATCH_SIZE = 100;

/**
 * Concurrent players in flight. Each one issues two API calls at once, so the
 * real request concurrency is double this. Kept deliberately low: the API
 * throttles aggressively, and a failed sample costs a whole day of coverage.
 */
const CONCURRENCY = 2;

/** Retries per player when the API throttles or times out. */
const MAX_RETRIES = 3;

/**
 * Ranking refreshes issue one call each rather than two, so they can run wider
 * than player sampling without doubling the real request rate.
 */
const RANKING_CONCURRENCY = 6;

/** How many days of battle samples feed win/usage rates. */
const WINDOW_DAYS = 7;

/**
 * Battle types the win rate is computed from.
 *
 * The API's `"ranked"` type is the trophy ladder, not the competitive mode,
 * and the distinction decides whether the tier list means anything. Measured
 * over a week of our own samples: trophy-ladder battles came back at a 78.0%
 * win rate, because a pool seeded from the global trophy leaderboard is mostly
 * strong players farming weaker lobbies. The same players in competitive
 * Ranked (`soloRanked`) won 54.3% — matchmaking there pairs comparable
 * opponents, so what is left is closer to the brawler's own contribution.
 *
 * Pick rate still counts every battle: what people choose to play is
 * interesting on the ladder too, and it is not distorted by who they faced.
 */
const COMPETITIVE_BATTLE_TYPES = ['soloRanked', 'teamRanked'];

/**
 * Stop seeding once the pool is at least this big.
 *
 * Deliberately kept near twice the daily sample rate. A battle log only holds
 * a player's most recent ~25 battles, so a pool large enough that each tag is
 * revisited less often than every couple of days starts silently dropping
 * battles between visits. Breadth past that point costs accuracy rather than
 * adding it.
 */
const POOL_TARGET = 800;

export interface AggregationResult {
  playersSampled: number;
  battlesRecorded: number;
  brawlersUpdated: number;
  seeded: number;
  /** Roster/kit differences detected against yesterday's catalogue snapshot. */
  catalogChanges: number;
  /** Cached brawler-leaderboard rows stored this run. */
  rankingsCached: number;
  /** Ability-ownership rows recomputed for popular builds. */
  buildRowsUpdated: number;
  status: 'ok' | 'partial' | 'failed';
  notes?: string;
}

/** Midnight UTC today, matching the `@db.Date` columns. */
function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries only the failures that are worth retrying. A 404 for a deleted
 * account will never succeed, but throttling and timeouts clear on their own,
 * and backing off is what keeps a large batch from cascading into failure.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const code = toApiError(err).code;
      if (code !== 'rateLimited' && code !== 'timeout' && code !== 'upstreamDown') throw err;
      if (attempt === MAX_RETRIES) break;

      // 500ms, 1s, 2s — enough for a throttle window to reopen.
      await sleep(500 * 2 ** attempt);
    }
  }

  throw lastError;
}

/** Runs `worker` over `items` with a fixed concurrency ceiling. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/* ------------------------------ pool seeding ------------------------------ */

/**
 * Tops up the sampling pool from the global trophy leaderboard and the rosters
 * of the top clubs.
 *
 * This is a top-ladder sample, which is a real bias: it over-represents
 * high-trophy play. It is a defensible starting point because those players
 * battle constantly, but it is not a representative sample of the whole
 * player base — see the README.
 */
export async function seedSamplePool(): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) return 0;

  const existing = await prisma.sampledPlayer.count();
  if (existing >= POOL_TARGET) return 0;

  const candidates = new Map<string, { name?: string; trophies?: number; source: string }>();

  try {
    const topPlayers = await getPlayerRankings('global', 200);
    for (const p of topPlayers.items) {
      candidates.set(normalizeTag(p.tag), {
        name: p.name,
        trophies: p.trophies,
        source: 'ranking',
      });
    }
  } catch {
    // Seeding is best-effort; sampling can still proceed with the existing pool.
  }

  // Club rosters widen the pool past the leaderboard's 200-player ceiling.
  try {
    const topClubs = await getClubRankings('global', 10);
    for (const club of topClubs.items) {
      try {
        const full = await getClub(normalizeTag(club.tag));
        for (const member of full.members ?? []) {
          const tag = normalizeTag(member.tag);
          if (!candidates.has(tag)) {
            candidates.set(tag, {
              name: member.name,
              trophies: member.trophies,
              source: 'club',
            });
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Ignore — the ranking seed above is enough to make progress.
  }

  if (candidates.size === 0) return 0;

  const result = await prisma.sampledPlayer.createMany({
    data: [...candidates.entries()].map(([tag, meta]) => ({
      tag,
      name: meta.name,
      trophies: meta.trophies,
      source: meta.source,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

/* -------------------------------- sampling -------------------------------- */

/** Finds the sampled player's own entry in a battle, across all mode shapes. */
function findSelf(entry: BSBattleLogEntry, playerTag: string): BSBattlePlayer | undefined {
  const { teams, players } = entry.battle;
  const all = teams ? teams.flat() : (players ?? []);
  return all.find((p) => normalizeTag(p.tag) === playerTag);
}

async function samplePlayer(tag: string) {
  const prisma = getPrisma();
  if (!prisma) return { battles: 0 };

  const normalized = normalizeTag(tag);
  const [player, log] = await Promise.all([
    withRetry(() => getPlayer(normalized)),
    withRetry(() => getBattleLog(normalized)),
  ]);

  const snapshotDate = todayUtc();

  // Trophy/rank distribution plus which abilities this player owns, which is
  // what the popular-build percentages are computed from.
  if (player.brawlers.length > 0) {
    await prisma.playerBrawlerSnapshot.createMany({
      data: player.brawlers.map((b) => ({
        playerTag: normalized,
        brawlerId: b.id,
        brawlerName: b.name,
        trophies: b.trophies,
        highestTroph: b.highestTrophies,
        rank: b.rank,
        power: b.power,
        starPowerIds: (b.starPowers ?? []).map((x) => x.id),
        gadgetIds: (b.gadgets ?? []).map((x) => x.id),
        gearIds: (b.gears ?? []).map((x) => x.id),
        buffieGadget: Boolean(b.buffies?.gadget),
        buffieStarPower: Boolean(b.buffies?.starPower),
        buffieHyperCharge: Boolean(b.buffies?.hyperCharge),
        snapshotDate,
      })),
      skipDuplicates: true,
    });
  }

  // One battle sample per match, recording only this player's own brawler.
  const samples = [];
  for (const entry of log.items) {
    const self = findSelf(entry, normalized);
    const brawler = self?.brawler ?? self?.brawlers?.[0];
    if (!brawler) continue;

    const battleTime = parseApiDate(entry.battleTime);
    if (!battleTime) continue;

    // Friendlies and map-maker games do not reflect competitive balance.
    const type = entry.battle.type ?? 'unknown';
    if (type === 'friendly') continue;

    samples.push({
      battleKey: `${entry.battleTime}:${normalized}`,
      playerTag: normalized,
      brawlerId: brawler.id,
      brawlerName: brawler.name,
      // Showdown reports a placement instead of a result; recorded as "rank"
      // so it counts toward usage but never toward win rate.
      result: entry.battle.result ?? 'rank',
      rank: entry.battle.rank ?? null,
      mode: entry.battle.mode ?? entry.event.mode ?? 'unknown',
      battleType: type,
      trophyChange: entry.battle.trophyChange ?? null,
      battleTime,
    });
  }

  let recorded = 0;
  if (samples.length > 0) {
    const result = await prisma.battleSample.createMany({
      data: samples,
      skipDuplicates: true,
    });
    recorded = result.count;
  }

  await prisma.sampledPlayer.update({
    where: { tag: normalized },
    data: { lastSampledAt: new Date(), name: player.name, trophies: player.trophies },
  });

  return { battles: recorded };
}

/* ------------------------------- aggregation ------------------------------ */

/**
 * Recomputes today's `brawler_stats` from the trailing window. Idempotent —
 * running it twice in a day overwrites rather than duplicates.
 */
export async function recomputeBrawlerStats(): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) return 0;

  const snapshotDate = todayUtc();
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

  // Run sequentially rather than in parallel: this executes once a day, and
  // serialising it keeps the job within a single connection, which matters on
  // connection-capped free-tier Postgres.
  // Every battle, for pick rate.
  const battleGroups = await prisma.battleSample.groupBy({
    by: ['brawlerId', 'brawlerName', 'result'],
    where: { battleTime: { gte: since } },
    _count: { _all: true },
  });

  // Competitive battles only, for win rate. See COMPETITIVE_BATTLE_TYPES.
  const competitiveGroups = await prisma.battleSample.groupBy({
    by: ['brawlerId', 'brawlerName', 'result'],
    where: { battleTime: { gte: since }, battleType: { in: COMPETITIVE_BATTLE_TYPES } },
    _count: { _all: true },
  });

  const ownerGroups = await prisma.playerBrawlerSnapshot.groupBy({
    by: ['brawlerId', 'brawlerName'],
    where: { snapshotDate: { gte: new Date(since.toISOString().slice(0, 10)) } },
    _avg: { trophies: true, rank: true },
    _count: { _all: true },
  });

  const totalBattles = await prisma.battleSample.count({
    where: { battleTime: { gte: since } },
  });

  // Fold the per-result groups into one accumulator per brawler. Two passes
  // over the same shape: `byBrawler` counts everything and feeds pick rate,
  // `competitive` counts only ranked play and feeds win rate.
  type Acc = { name: string; wins: number; losses: number; draws: number; total: number };

  function fold(groups: typeof battleGroups): Map<number, Acc> {
    const out = new Map<number, Acc>();
    for (const group of groups) {
      const current = out.get(group.brawlerId) ?? {
        name: group.brawlerName,
        wins: 0,
        losses: 0,
        draws: 0,
        total: 0,
      };
      const count = group._count._all;

      if (group.result === 'victory') current.wins += count;
      else if (group.result === 'defeat') current.losses += count;
      else if (group.result === 'draw') current.draws += count;

      current.total += count;
      out.set(group.brawlerId, current);
    }
    return out;
  }

  const byBrawler = fold(battleGroups);
  const competitive = fold(competitiveGroups);

  // Population baseline: how often the sampled cohort wins in competitive
  // play, across every brawler. Tiers are assigned relative to this, because
  // even in Ranked the pool is drawn from the top of the ladder.
  let populationWins = 0;
  let populationDecided = 0;
  for (const acc of competitive.values()) {
    populationWins += acc.wins;
    populationDecided += acc.wins + acc.losses;
  }
  const baselineWinRate = populationDecided > 0 ? populationWins / populationDecided : null;

  const owners = new Map(ownerGroups.map((g) => [g.brawlerId, g]));
  const brawlerIds = new Set([...byBrawler.keys(), ...owners.keys()]);

  // Same batching rationale as build stats: one delete plus one insert instead
  // of ~106 sequential upserts against a remote database.
  const pendingStats: {
    brawlerId: number;
    brawlerName: string;
    snapshotDate: Date;
    winRate: number | null;
    baselineWinRate: number | null;
    usageRate: number | null;
    avgTrophies: number | null;
    avgRank: number | null;
    sampleSize: number;
    decidedSampleSize: number;
    ownerSampleSize: number;
    windowDays: number;
  }[] = [];

  for (const brawlerId of brawlerIds) {
    const battles = byBrawler.get(brawlerId);
    const ranked = competitive.get(brawlerId);
    const owner = owners.get(brawlerId);

    // Draws are excluded from the denominator: a draw is neither a win nor a
    // loss, and including them drags every brawler toward the mean.
    const decided = ranked ? ranked.wins + ranked.losses : 0;
    const winRate = decided > 0 ? ranked!.wins / decided : null;
    const usageRate = totalBattles > 0 && battles ? battles.total / totalBattles : null;

    const name = battles?.name ?? ranked?.name ?? owner?.brawlerName ?? `Brawler ${brawlerId}`;

    pendingStats.push({
      brawlerId,
      snapshotDate,
      brawlerName: name,
      winRate,
      baselineWinRate,
      usageRate,
      avgTrophies: owner?._avg.trophies ?? null,
      avgRank: owner?._avg.rank ?? null,
      sampleSize: battles?.total ?? 0,
      decidedSampleSize: decided,
      ownerSampleSize: owner?._count._all ?? 0,
      windowDays: WINDOW_DAYS,
    });
  }

  if (pendingStats.length === 0) return 0;

  await prisma.brawlerStat.deleteMany({ where: { snapshotDate } });
  const created = await prisma.brawlerStat.createMany({
    data: pendingStats,
    skipDuplicates: true,
  });

  return created.count;
}

/* ---------------------------- brawler rankings ---------------------------- */

/**
 * Caches the global top-200 for every brawler.
 *
 * One API call per brawler (~106), which is why it lives in the daily cron and
 * not on the request path: resolving a player's placements would otherwise
 * cost 106 calls per profile view.
 */
export async function refreshBrawlerRankings(budgetMs = 20_000): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) return 0;

  const catalogue = await getOfficialBrawlers()
    .then((r) => r.items)
    .catch(() => []);
  if (catalogue.length === 0) return 0;

  // Refresh only what is stale. Combined with the time budget this makes the
  // pass resumable: whatever does not fit in one run is picked up by the next,
  // so a serverless timeout can never leave the cache permanently half-built.
  const startOfDay = todayUtc();
  const fresh = await prisma.brawlerRankingEntry.findMany({
    where: { refreshedAt: { gte: startOfDay } },
    distinct: ['brawlerId'],
    select: { brawlerId: true },
  });
  const freshIds = new Set(fresh.map((r) => r.brawlerId));
  const pending = catalogue.filter((b) => !freshIds.has(b.id));
  if (pending.length === 0) return 0;

  const deadline = Date.now() + budgetMs;
  let stored = 0;

  const results = await mapLimit(pending, RANKING_CONCURRENCY, async (brawler) => {
    if (Date.now() > deadline) return 0;
    const board = await withRetry(() => getBrawlerRankings(brawler.id, 'global', 200));
    if (board.items.length === 0) return 0;

    // Replace wholesale: ranks shift every day and stale rows would otherwise
    // linger as phantom placements.
    await prisma.brawlerRankingEntry.deleteMany({
      where: { brawlerId: brawler.id, region: 'global' },
    });
    const created = await prisma.brawlerRankingEntry.createMany({
      data: board.items.map((entry) => ({
        brawlerId: brawler.id,
        brawlerName: brawler.name,
        region: 'global',
        rank: entry.rank,
        playerTag: normalizeTag(entry.tag),
        playerName: entry.name,
        trophies: entry.trophies,
        refreshedAt: new Date(),
      })),
      skipDuplicates: true,
    });
    return created.count;
  });

  for (const result of results) {
    if (result.status === 'fulfilled') stored += result.value;
  }
  return stored;
}

/* ------------------------------ popular builds ---------------------------- */

/**
 * Recomputes ability-ownership rates per brawler from the trailing window.
 *
 * Uses `unnest` so Postgres does the array expansion — doing this in
 * application code would mean pulling every snapshot row over the wire.
 */
export async function recomputeBuildStats(): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) return 0;

  const snapshotDate = todayUtc();
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const sinceDate = new Date(since.toISOString().slice(0, 10));

  const kinds: { kind: string; column: string }[] = [
    { kind: 'starPower', column: 'star_power_ids' },
    { kind: 'gadget', column: 'gadget_ids' },
    { kind: 'gear', column: 'gear_ids' },
  ];

  /*
   * The denominator is counted per kind, over rows where that column is
   * actually populated.
   *
   * Snapshots written before the ability columns existed have NULL arrays.
   * Counting them as owners-with-no-unlocks put ~440 phantom rows behind every
   * Shelly percentage and dragged a true ~97% unlock rate down to ~16%. A NULL
   * means "not recorded", not "owns nothing", and must not be a denominator.
   */
  const totalsByKind = new Map<string, Map<number, number>>();
  for (const { kind, column } of kinds) {
    const rows = await prisma.$queryRawUnsafe<{ brawler_id: number; total: bigint }[]>(
      `SELECT brawler_id, COUNT(DISTINCT player_tag) AS total
       FROM player_brawler_snapshots
       WHERE snapshot_date >= $1 AND ${column} IS NOT NULL
       GROUP BY brawler_id`,
      sinceDate,
    );
    totalsByKind.set(kind, new Map(rows.map((r) => [r.brawler_id, Number(r.total)])));
  }

  if ([...totalsByKind.values()].every((m) => m.size === 0)) return 0;

  // Collected and written in one batch. Upserting row by row meant ~1,000
  // sequential round trips to a remote database, which dominated the whole
  // run; delete-then-insert is two round trips and just as idempotent.
  const pending: {
    brawlerId: number;
    snapshotDate: Date;
    kind: string;
    itemId: number;
    owners: number;
    totalOwners: number;
  }[] = [];

  for (const { kind, column } of kinds) {
    // The column name is from this fixed list, never user input.
    const rows = await prisma.$queryRawUnsafe<
      { brawler_id: number; item_id: number; owners: bigint }[]
    >(
      `SELECT brawler_id, item_id, COUNT(DISTINCT player_tag) AS owners
       FROM (
         SELECT player_tag, brawler_id, unnest(${column}) AS item_id
         FROM player_brawler_snapshots
         WHERE snapshot_date >= $1 AND ${column} IS NOT NULL
       ) expanded
       GROUP BY brawler_id, item_id`,
      sinceDate,
    );

    const totalByBrawler = totalsByKind.get(kind);
    for (const row of rows) {
      const totalOwners = totalByBrawler?.get(row.brawler_id) ?? 0;
      if (totalOwners === 0) continue;

      pending.push({
        brawlerId: row.brawler_id,
        snapshotDate,
        kind,
        itemId: row.item_id,
        owners: Number(row.owners),
        totalOwners,
      });
    }
  }

  if (pending.length === 0) return 0;

  await prisma.brawlerBuildStat.deleteMany({ where: { snapshotDate } });
  const created = await prisma.brawlerBuildStat.createMany({
    data: pending,
    skipDuplicates: true,
  });

  return created.count;
}

/* --------------------------------- driver --------------------------------- */

/**
 * Wall-clock budget for a whole run.
 *
 * Vercel's Hobby ceiling is 300s (both the default and the maximum), and the
 * route declares `maxDuration = 300` to match. This sits 30s under it so the
 * response still gets written if the last step runs long: overshooting means a
 * 504 and, because Vercel never retries a cron, a whole slot of coverage lost.
 */
const RUN_BUDGET_MS = 270_000;

/** Always give rankings at least this long, even on a slow run. */
const RANKING_MIN_BUDGET_MS = 15_000;

/**
 * Held back for `recomputeBrawlerStats` and `recomputeBuildStats`.
 *
 * Both scale with the number of battle samples in the trailing window, so this
 * reserve has to grow with the batch size. Starving them is the worst possible
 * failure: the samples land in the database but nothing turns them into the
 * rows the tier list actually reads.
 */
const RECOMPUTE_RESERVE_MS = 40_000;

export async function runAggregation(batchSize = DEFAULT_BATCH_SIZE): Promise<AggregationResult> {
  const deadline = Date.now() + RUN_BUDGET_MS;
  const prisma = getPrisma();
  if (!prisma) {
    return {
      playersSampled: 0,
      battlesRecorded: 0,
      brawlersUpdated: 0,
      seeded: 0,
      catalogChanges: 0,
      rankingsCached: 0,
      buildRowsUpdated: 0,
      status: 'failed',
      notes: 'DATABASE_URL is not set — provision Neon before running the cron job.',
    };
  }

  const run = await prisma.aggregationRun.create({ data: {} });

  try {
    // Cheap (one API call) and independent of sampling, so it runs first and
    // is never starved by a slow or failing batch.
    const catalog = await snapshotAndDiffCatalog().catch(() => ({
      brawlers: 0,
      changes: 0,
    }));

    const seeded = await seedSamplePool();

    // Least-recently-sampled first, so the pool rotates instead of re-reading
    // the same players every day.
    const targets = await prisma.sampledPlayer.findMany({
      orderBy: [{ lastSampledAt: { sort: 'asc', nulls: 'first' } }],
      take: batchSize,
      select: { tag: true },
    });

    // Leave room for aggregation and the ranking pass: sampling stops early
    // rather than starving the steps that turn samples into readable data.
    const samplingDeadline = deadline - RANKING_MIN_BUDGET_MS - RECOMPUTE_RESERVE_MS;
    const results = await mapLimit(targets, CONCURRENCY, (t) => {
      if (Date.now() > samplingDeadline) {
        throw new BrawlApiError('timeout', 'Run budget exhausted before sampling this player');
      }
      return samplePlayer(t.tag);
    });

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const battlesRecorded = fulfilled.reduce(
      (sum, r) => sum + (r as PromiseFulfilledResult<{ battles: number }>).value.battles,
      0,
    );
    const failures = results.length - fulfilled.length;

    // Group failure reasons so a bad run says *why*, not just how many.
    const reasons = new Map<string, number>();
    for (const result of results) {
      if (result.status === 'rejected') {
        const code = toApiError(result.reason).code;
        reasons.set(code, (reasons.get(code) ?? 0) + 1);
      }
    }

    // Checkpoint the sampling work before recomputing. If aggregation fails,
    // the run record still shows what was collected rather than reporting zero.
    await prisma.aggregationRun.update({
      where: { id: run.id },
      data: { playersSampled: fulfilled.length, battlesRecorded },
    });

    const brawlersUpdated = await recomputeBrawlerStats();
    const buildRowsUpdated = await recomputeBuildStats().catch(() => 0);

    // Last and time-boxed, because it is the most API-expensive step. It gets
    // whatever is left of the run budget and resumes where it stopped on the
    // next run, so a short night costs freshness rather than correctness.
    const remainingMs = Math.max(RANKING_MIN_BUDGET_MS, deadline - Date.now());
    const rankingsCached = await refreshBrawlerRankings(remainingMs).catch(() => 0);

    const status: AggregationResult['status'] =
      failures === 0 ? 'ok' : fulfilled.length === 0 ? 'failed' : 'partial';
    const notes =
      failures > 0
        ? `${failures} of ${results.length} player samples failed (${[...reasons]
            .map(([code, count]) => `${code}: ${count}`)
            .join(', ')})`
        : undefined;

    await prisma.aggregationRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        playersSampled: fulfilled.length,
        battlesRecorded,
        brawlersUpdated,
        status,
        notes,
      },
    });

    return {
      playersSampled: fulfilled.length,
      battlesRecorded,
      brawlersUpdated,
      seeded,
      catalogChanges: catalog.changes,
      rankingsCached,
      buildRowsUpdated,
      status,
      notes,
    };
  } catch (err) {
    const notes = err instanceof Error ? err.message : 'Unknown aggregation failure';
    await prisma.aggregationRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: 'failed', notes },
    });
    throw err;
  }
}
