import 'server-only';

import {
  getBattleLog,
  getClub,
  getClubRankings,
  getPlayer,
  getPlayerRankings,
} from '@/lib/bs-api';
import { toApiError } from '@/lib/errors';
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

/** Players sampled per run. 2 API calls each. */
const DEFAULT_BATCH_SIZE = 25;

/**
 * Concurrent players in flight. Each one issues two API calls at once, so the
 * real request concurrency is double this. Kept deliberately low: the API
 * throttles aggressively, and a failed sample costs a whole day of coverage.
 */
const CONCURRENCY = 2;

/** Retries per player when the API throttles or times out. */
const MAX_RETRIES = 3;

/** How many days of battle samples feed win/usage rates. */
const WINDOW_DAYS = 7;

/** Stop seeding once the pool is at least this big. */
const POOL_TARGET = 500;

export interface AggregationResult {
  playersSampled: number;
  battlesRecorded: number;
  brawlersUpdated: number;
  seeded: number;
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

  // Trophy/rank distribution for every brawler this player owns.
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
  const battleGroups = await prisma.battleSample.groupBy({
    by: ['brawlerId', 'brawlerName', 'result'],
    where: { battleTime: { gte: since } },
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

  // Fold the per-result groups into one accumulator per brawler.
  const byBrawler = new Map<
    number,
    { name: string; wins: number; losses: number; draws: number; total: number }
  >();

  for (const group of battleGroups) {
    const current = byBrawler.get(group.brawlerId) ?? {
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
    byBrawler.set(group.brawlerId, current);
  }

  // Population baseline: how often the sampled cohort wins overall, across
  // every brawler. Tiers are assigned relative to this, because the pool is
  // drawn from top ladder and wins far more than an average player would.
  let populationWins = 0;
  let populationDecided = 0;
  for (const acc of byBrawler.values()) {
    populationWins += acc.wins;
    populationDecided += acc.wins + acc.losses;
  }
  const baselineWinRate = populationDecided > 0 ? populationWins / populationDecided : null;

  const owners = new Map(ownerGroups.map((g) => [g.brawlerId, g]));
  const brawlerIds = new Set([...byBrawler.keys(), ...owners.keys()]);

  let updated = 0;
  for (const brawlerId of brawlerIds) {
    const battles = byBrawler.get(brawlerId);
    const owner = owners.get(brawlerId);

    // Draws are excluded from the denominator: a draw is neither a win nor a
    // loss, and including them drags every brawler toward the mean.
    const decided = battles ? battles.wins + battles.losses : 0;
    const winRate = decided > 0 ? battles!.wins / decided : null;
    const usageRate = totalBattles > 0 && battles ? battles.total / totalBattles : null;

    const name = battles?.name ?? owner?.brawlerName ?? `Brawler ${brawlerId}`;

    const values = {
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
    };

    await prisma.brawlerStat.upsert({
      where: { brawlerId_snapshotDate: { brawlerId, snapshotDate } },
      create: { brawlerId, snapshotDate, ...values },
      update: values,
    });
    updated++;
  }

  return updated;
}

/* --------------------------------- driver --------------------------------- */

export async function runAggregation(batchSize = DEFAULT_BATCH_SIZE): Promise<AggregationResult> {
  const prisma = getPrisma();
  if (!prisma) {
    return {
      playersSampled: 0,
      battlesRecorded: 0,
      brawlersUpdated: 0,
      seeded: 0,
      status: 'failed',
      notes: 'DATABASE_URL is not set — provision Neon before running the cron job.',
    };
  }

  const run = await prisma.aggregationRun.create({ data: {} });

  try {
    const seeded = await seedSamplePool();

    // Least-recently-sampled first, so the pool rotates instead of re-reading
    // the same players every day.
    const targets = await prisma.sampledPlayer.findMany({
      orderBy: [{ lastSampledAt: { sort: 'asc', nulls: 'first' } }],
      take: batchSize,
      select: { tag: true },
    });

    const results = await mapLimit(targets, CONCURRENCY, (t) => samplePlayer(t.tag));

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
