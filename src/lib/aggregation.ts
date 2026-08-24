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
import { COMPETITIVE_BATTLE_TYPES, windowStartUtc } from '@/lib/stats';
import { POPULAR_REGION_CODES } from '@/lib/regions';
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
 * than overrunning the function.
 *
 * Raised from 100 because 100 was leaving most of the budget unused while
 * actively losing data. A battle log holds only a player's last ~25 matches,
 * and at 100 per run each tag was revisited about every two days — measured
 * against live data, **48% of sampled players came back sitting on the 25-match
 * cap**, meaning everything they played in the gap was gone for good.
 *
 * Sized to cover the whole pool in one run, which is the point.
 *
 * Measured on live data, the previous cadence was losing battles outright:
 * across 1,545 visits the average player came back with 24.9 new battles, and
 * 68% of them were sitting on the log's 25-match ceiling. A player at the
 * ceiling has played more than we can read, and everything past 25 is gone for
 * good. Sampling half the pool per run meant a six-hour revisit interval, and
 * an active account plays through 25 matches well inside that.
 *
 * So the batch now matches POOL_TARGET rather than a fraction of it: every
 * member is read every run, and the revisit interval becomes the gap between
 * runs instead of a multiple of it. Overrunning is safe either way, since
 * sampling stops at the deadline rather than at the batch size.
 */
const DEFAULT_BATCH_SIZE = 1000;

/**
 * Concurrent players in flight. Each issues two API calls at once, so the real
 * request concurrency is double this.
 *
 * Raised with the batch, because the two only work together: a thousand
 * players at 3 in flight overruns the sampling budget, and the deadline then
 * truncates the run, reintroducing the partial coverage this change exists to
 * remove. At 5 the same thousand lands near 200s, inside the ~215s available.
 *
 * `withRetry` still backs off on throttling, so pushing this too far costs a
 * slower run rather than lost samples.
 */
const CONCURRENCY = 5;

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
 * How big the sampling pool is held at.
 *
 * Deliberately kept near twice the daily sample rate. A battle log only holds
 * a player's most recent ~25 battles, so a pool large enough that each tag is
 * revisited less often than every couple of days starts silently dropping
 * battles between visits. Breadth past that point costs accuracy rather than
 * adding it.
 *
 * This is a steady-state size, not a stopping point. An earlier version
 * returned early once the pool reached it, which froze the pool permanently:
 * the top-200 seed became a one-off snapshot, nobody new could enter, and
 * every meta number on the site described the same 800 accounts forever. The
 * cap is now maintained by eviction instead — see `evictStalePool`.
 *
 * Held at what one run can actually read, since the batch above is now the
 * whole pool by design. Growing this past a run's wall clock would quietly
 * reintroduce the partial coverage that was losing battles.
 *
 * Breadth now comes from *which* accounts are in the pool rather than from how
 * many: see `seedSamplePool`, which draws on regional leaderboards as well as
 * the global one.
 */
const POOL_TARGET = 1000;

/**
 * How many trailing days of roll-up are rebuilt from raw rows each run.
 *
 * A day is only final once it is over, and battles keep arriving into the
 * current one all day, so today and yesterday are always recomputed. The third
 * day is slack: it means a run can fail, or land late enough to straddle a
 * date boundary, without leaving a day permanently half-counted.
 *
 * Rebuilt rather than incremented because rebuilding is idempotent and
 * incrementing is not. The sampler re-reads players whose battle logs overlap
 * what it already has, and `skipDuplicates` silently drops those — an
 * incremental counter has no way to tell a dropped duplicate from a new
 * battle, so it would drift upward on exactly the rows the raw table was
 * careful to deduplicate.
 */
const ROLLUP_REBUILD_DAYS = 3;

/**
 * How long the roll-ups are kept.
 *
 * This is the window the site actually reads, so it is set by the longest
 * read rather than by storage: RANKED_MAP_WINDOW_DAYS is 21, and the tier
 * list offers a 30-day option. That option had been quietly reading 24 days,
 * because BATTLE_RETENTION_DAYS was 24 and nothing warned that the request was
 * being truncated. At roll-up sizes 30 days is affordable, so the option now
 * gets the window it claims.
 */
const ROLLUP_RETENTION_DAYS = 30;

/**
 * How long the pairing and per-player roll-ups are kept.
 *
 * Shorter than the above because nothing reads them that far back: the deepest
 * caller is the 21-day matchup window, and the 30-day tier-list option only
 * ever touches `battle_daily_stats`. Three days of margin over 21, matching
 * ROLLUP_REBUILD_DAYS.
 *
 * Worth separating because these are the expensive roll-ups, not the cheap
 * one. `brawler_pair_daily` produces ~30k rows a day against
 * `battle_daily_stats`'s ~8k — one battle becomes several pairings — so the
 * days between 30 and 22 cost more there than the whole of the table this
 * exists to serve.
 *
 * Twenty-two, not twenty-one: one day of margin over the read window. Setting
 * retention *equal* to it would mean the oldest day the reads ask for is the
 * same day the prune is entitled to delete, and a matchup window would quietly
 * shrink or not depending on the order the two ran in.
 */
const PAIRING_ROLLUP_RETENTION_DAYS = 22;

/*
 * Both roll-up windows above are the `ok` row of RETENTION_UNDER_PRESSURE,
 * which is what the prune actually reads. They are named here because that is
 * where the reasoning for the numbers lives.
 */

/**
 * How long raw battle rows are kept.
 *
 * Days, not weeks, because nothing reads them any more. Every query against
 * `battle_samples` and `battle_team_samples` is a GROUP BY or a COUNT, so the
 * long windows the site reads are served by the daily roll-ups instead (see
 * `rollUpBattles`), and raw rows only have to survive long enough to be folded
 * into them.
 *
 * The previous 24 days was sized for a sampling rate that no longer exists.
 * Measured on 2026-08-24 the rate had roughly quadrupled inside a week — 15k
 * battles/day on the 17th, 55k by the 23rd — and at 370 B/row, 21 days of raw
 * battles is ~430 MB against a 512 MB ceiling. The old windows projected to
 * ~990 MB, a wall about three weeks out, and no pruning schedule could have
 * moved it: 21 days is what the per-map ranked tier list reads, so the window
 * could not be cut without cutting the feature.
 *
 * Three days is ROLLUP_REBUILD_DAYS: raw rows are kept exactly as long as they
 * are still being folded, and no longer. The prune additionally refuses to
 * delete any day that has not been rolled up, so this is a ceiling on how long
 * rows live rather than a promise that they die on schedule.
 *
 * Getting this wrong is unrecoverable — the game API serves only a player's
 * last ~25 battles and has no history endpoint — which is why the roll-up runs
 * before the prune in `runAggregation`, and why the prune checks its work
 * rather than trusting the clock.
 */
const RAW_BATTLE_RETENTION_DAYS = ROLLUP_REBUILD_DAYS;

/**
 * Snapshots are kept for days, not weeks, and full-pool sampling is why.
 *
 * The old ten days existed to accumulate coverage: sampling a fraction of the
 * pool per run meant it took over a week before every member had been seen
 * once, and the reads that count owners needed that whole span to be looking
 * at everybody. Now every member is read every run, so a single day already
 * contains the entire pool and the extra days are duplicates of it.
 *
 * That matters because this is by far the largest table: one row per player
 * per brawler per day, which at a thousand mostly-complete accounts is over a
 * hundred thousand rows a day. At ten days it alone was heading for ~275MB and
 * would have pushed the database past its free-tier ceiling within a fortnight.
 *
 * Two rather than one so a couple of consecutive failed runs cannot empty it —
 * runs are twice daily, so this is four of them — and so the reads that ask
 * for a week still find every player they need.
 *
 * Was four. Cut to two because the storage pressure valve had been holding it
 * at two for weeks anyway: the value it was defending was one the database
 * could not actually afford, so "four" described an intention rather than what
 * the site ran on. Making it the default costs ~40 MB less at the plateau and
 * makes the valve's own snapshot lever honest — it now only moves this under
 * genuine pressure, rather than every single run.
 */
const SNAPSHOT_RETENTION_DAYS = 2;

/**
 * A pool member producing no battles in this many days is inactive.
 *
 * They still cost two API calls per visit and contribute nothing, so they are
 * the first thing evicted when the pool is over its cap.
 */
const INACTIVE_AFTER_DAYS = 14;

/**
 * How long a looked-up tag stays safe from eviction.
 *
 * Lookups used to be protected *forever*, and that made the pool unbounded —
 * which made the database unbounded, on a plan with a hard 512 MB ceiling.
 * Every `/player/[tag]` render adds a row, `robots.ts` allows those pages to be
 * crawled, and the site links to thousands of tags from leaderboards, club
 * rosters and battle logs. A discovery crawl therefore enrolls players into the
 * sampling pool faster than any human ever could: on 2026-08-21 that ran at
 * roughly 500 new tags a day against a pool meant to hold a thousand, and each
 * one costs about 110 KB in daily brawler snapshots for as long as it stays.
 *
 * Two weeks, because that is `INACTIVE_AFTER_DAYS` — the same span the rest of
 * this file uses to mean "recently". A profile nobody has opened in a fortnight
 * stops being re-read, which pauses its trophy history rather than deleting it:
 * the rows already recorded stay, and the tag comes straight back the moment
 * anyone opens the page again.
 */
const LOOKUP_PROTECTION_DAYS = 14;

/**
 * And a hard ceiling on how many lookups that window may protect at once.
 *
 * A window alone does not bound anything, which is the trap this originally
 * fell into: at a thousand crawled profiles a day, every one of them is
 * "opened recently" for the next fortnight, so a fortnight's protection is a
 * protected set of fourteen thousand. The window decides *who* is worth
 * keeping; this decides *how many*, and only the second one is a bound.
 *
 * A quarter of the pool. Enough that the profiles real visitors return to keep
 * their history running, small enough that the pool — and therefore the
 * database — cannot be grown by anyone who simply requests a lot of pages.
 */
const LOOKUP_PROTECTION_SLOTS = 250;

/**
 * Club rosters are only pulled when the pool actually needs filling.
 *
 * Refreshing the top-200 costs one call and is what keeps the cohort current;
 * walking ten club rosters costs eleven more and only widens it. Freshness is
 * worth paying for every run, breadth is not.
 */
const CLUBS_TO_SEED = 10;

/**
 * Regional leaderboards read per run, and how fast the window advances.
 *
 * Six calls a run against the ~4,200 the sampler already makes, covering the
 * twenty-one highest-population regions in about four runs. Slow rotation is
 * deliberate: a region's top 200 barely moves hour to hour, so re-reading the
 * same one repeatedly would add cost without adding accounts.
 */
const REGIONS_PER_RUN = 6;
const REGION_ROTATION_MS = 4 * 3600_000;

export interface AggregationResult {
  playersSampled: number;
  battlesRecorded: number;
  brawlersUpdated: number;
  seeded: number;
  /** Pool members dropped this run to keep the pool at POOL_TARGET. */
  evicted: number;
  /** Roll-up rows written this run by `rollUpBattles`. */
  rolledUp: number;
  /** Raw observation rows deleted as past their retention window. */
  pruned: number;
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
export async function seedSamplePool(): Promise<{ seeded: number; ranked: string[] }> {
  const prisma = getPrisma();
  if (!prisma) return { seeded: 0, ranked: [] };

  const candidates = new Map<string, { name?: string; trophies?: number; source: string }>();
  const ranked: string[] = [];

  // Refreshed on every run, not once. One API call, and it is the whole point
  // of rotation: the global top 200 changes, and a pool seeded from a frozen
  // snapshot slowly becomes a list of who used to be good.
  try {
    const topPlayers = await getPlayerRankings('global', 200);
    for (const p of topPlayers.items) {
      const tag = normalizeTag(p.tag);
      ranked.push(tag);
      candidates.set(tag, { name: p.name, trophies: p.trophies, source: 'ranking' });
    }
  } catch {
    // Seeding is best-effort; sampling can still proceed with the existing pool.
  }

  /*
   * Regional leaderboards, a rotating handful per run.
   *
   * The global top 200 plus their clubs is a narrow slice: a few hundred of
   * the highest-trophy accounts in the world, who play a particular way and
   * favour particular modes. That bias is why per-map and per-mode samples stay
   * thin for anything they do not touch.
   *
   * Every supported country publishes its own top 200, and those lists barely
   * overlap with the global one or with each other, so each is a few hundred
   * genuinely different accounts for one API call. Fetching all of them every
   * run would be 250 calls, so a window rotates: the offset advances with the
   * clock, and the whole list is covered over a day or so.
   */
  const offset = Math.floor(Date.now() / REGION_ROTATION_MS) % POPULAR_REGION_CODES.length;
  const regions = Array.from(
    { length: REGIONS_PER_RUN },
    (_, i) => POPULAR_REGION_CODES[(offset + i) % POPULAR_REGION_CODES.length],
  );

  for (const region of regions) {
    try {
      const board = await getPlayerRankings(region, 200);
      for (const p of board.items) {
        const tag = normalizeTag(p.tag);
        // Never downgrade a global-ranked entry to a regional one; `ranked`
        // is what eviction protects.
        if (!candidates.has(tag)) {
          candidates.set(tag, { name: p.name, trophies: p.trophies, source: 'region' });
        }
      }
    } catch {
      // One unavailable region costs its own share, never the run.
      continue;
    }
  }

  // Club rosters widen the pool past the leaderboard's 200-player ceiling, and
  // are only worth their eleven API calls while the pool is short.
  const existing = await prisma.sampledPlayer.count();
  if (existing < POOL_TARGET) {
    try {
      const topClubs = await getClubRankings('global', CLUBS_TO_SEED);
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
  }

  if (candidates.size === 0) return { seeded: 0, ranked };

  const result = await prisma.sampledPlayer.createMany({
    data: [...candidates.entries()].map(([tag, meta]) => ({
      tag,
      name: meta.name,
      trophies: meta.trophies,
      source: meta.source,
    })),
    skipDuplicates: true,
  });

  return { seeded: result.count, ranked };
}

/**
 * The storage ceiling this project is built to live under, and the level at
 * which the prune starts defending it.
 *
 * The database is a free Neon instance with a hard 512 MB limit and no
 * intention of ever costing anything, so "we will notice before it fills" is
 * not a plan — nobody is watching, and the failure mode is writes being
 * refused. Above the high-water mark the prune shortens its retention windows
 * instead, spending accuracy to hold the line — see RETENTION_UNDER_PRESSURE
 * for which windows, in which order, and what each one costs.
 *
 * Tightening costs accuracy, not correctness: every window it touches is one
 * where the data is still there, just shallower. Nothing it does can lose an
 * observation that cannot be re-derived, which is why the raw battle window is
 * the one thing it will not touch.
 */
const STORAGE_LIMIT_BYTES = 512 * 1024 * 1024;

/**
 * Two levels, because there is no useful third one at the top.
 *
 * A valve that waits until the disk is nearly full cannot save anything, and
 * this is the part that is easy to get wrong: deleting rows does not shrink a
 * Postgres table. `DELETE` frees pages *inside* the file for reuse, which stops
 * growth; the file itself only shrinks under `VACUUM FULL`, which rewrites the
 * table and therefore needs room to write the copy into. At 95% there is no
 * such room. Measured on 2026-08-24: pruning 240k rows moved the reported size
 * from 464 MB to 464 MB, and the rewrite that followed took it to 270 MB.
 *
 * So the job here is to stop growth while there is still slack, not to recover
 * from having run out. 75% is where defending starts and 88% is where it gets
 * expensive; both are far enough down that the plateau lands under the ceiling
 * rather than at it.
 */
/**
 * The plan allowance covers data *and* history, but only data is measurable
 * from inside Postgres, so the valve is given a budget rather than the limit.
 *
 * Neon bills "Storage" as the database plus retained WAL, and the two are not
 * independent: `VACUUM FULL` rewrites every page of a table, and every
 * rewritten page becomes WAL. On 2026-08-24 the rewrite that took the data
 * from 460 MB to 284 MB pushed history to 0.18 GB, and the console still read
 * 98% — the saving moved from one column to the other. `pg_database_size` sees
 * none of that, so a valve pointed at the raw limit would defend a number
 * nobody is billed for.
 *
 * Hence a reserve. It is sized for history *after* the incremental fold, which
 * removed the standing churn that was feeding it — not for the 0.18 GB
 * measured during the migration, which was one-off. Whether it holds depends
 * on the project's history-retention setting, which lives in the Neon console
 * and cannot be read or set from here: a long PITR window on a database whose
 * every row is re-derivable will overrun this reserve no matter what the
 * pruner does.
 *
 * `neon.max_cluster_size` (512 MB, data only) is the separate limit that
 * actually refuses writes. Data staying inside the budget below keeps a wide
 * margin on it.
 */
const HISTORY_RESERVE_BYTES = 52 * 1024 * 1024;
const DATA_BUDGET_BYTES = STORAGE_LIMIT_BYTES - HISTORY_RESERVE_BYTES;

/*
 * Set so the *baseline* plateau sits below the high-water mark, which is the
 * property that makes this a valve rather than an oscillator. Projected at the
 * 2026-08-24 sampling rate the baseline windows plateau near 330 MB, against a
 * high-water mark of ~368 MB — so under normal growth the windows never move,
 * and pressure means the sampling rate genuinely changed rather than that the
 * defaults were set too generously.
 */
const STORAGE_HIGH_WATER = 0.80;
const STORAGE_CRITICAL = 0.93;

type StoragePressure = 'ok' | 'high' | 'critical';

/**
 * What the prune is allowed to spend, at each level of pressure.
 *
 * Ordered by what the loss actually costs, cheapest first, which is not the
 * same as biggest first:
 *
 * - Snapshots are the cheapest days on the site. Every read of that table takes
 *   the newest row per player-brawler, and full-pool sampling means one day
 *   already contains everybody — the rest is margin against failed runs.
 * - The pairing roll-ups thin the matchup numbers, a secondary feature, and
 *   they are the fastest-growing table (one battle becomes several pairings).
 * - `battle_daily_stats` is last and barely moves: cutting it to 21 days costs
 *   the tier list's 30-day option but keeps RANKED_MAP_WINDOW_DAYS intact,
 *   which is the feature the whole roll-up exists to serve.
 *
 * The raw window is deliberately absent. It is the margin that keeps a failed
 * roll-up from destroying battles the game API cannot serve again, and trading
 * an unrecoverable loss for a few megabytes is never the right trade.
 */
const RETENTION_UNDER_PRESSURE: Record<
  StoragePressure,
  { snapshots: number; pairing: number; rollup: number }
> = {
  ok: {
    snapshots: SNAPSHOT_RETENTION_DAYS,
    pairing: PAIRING_ROLLUP_RETENTION_DAYS,
    rollup: ROLLUP_RETENTION_DAYS,
  },
  high: { snapshots: 2, pairing: 14, rollup: 30 },
  critical: { snapshots: 1, pairing: 10, rollup: 21 },
};

/** Where the database sits against its ceiling, or 'ok' when unmeasurable. */
export function pressureFor(bytes: number | null): StoragePressure {
  if (bytes === null) return 'ok';
  if (bytes > DATA_BUDGET_BYTES * STORAGE_CRITICAL) return 'critical';
  if (bytes > DATA_BUDGET_BYTES * STORAGE_HIGH_WATER) return 'high';
  return 'ok';
}

/** Bytes on disk, or null when the question cannot be asked. */
export async function databaseBytes(): Promise<number | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  try {
    const rows = await prisma.$queryRaw<
      { bytes: bigint }[]
    >`SELECT pg_database_size(current_database()) AS bytes`;
    const bytes = Number(rows[0]?.bytes ?? 0);
    return Number.isFinite(bytes) && bytes > 0 ? bytes : null;
  } catch {
    // Reporting is not worth failing a run over.
    return null;
  }
}

/**
 * Folds raw battles into the daily roll-ups the site reads.
 *
 * Entirely server-side: each day is one DELETE and one INSERT ... SELECT, so
 * nothing crosses the wire but row counts. That matters because the raw rows
 * being folded are tens of thousands per day, and this runs on a serverless
 * function against a remote database.
 *
 * Days are chosen as the recent ones (see ROLLUP_REBUILD_DAYS) plus any day
 * still present in raw that has no roll-up rows at all. The second clause is
 * what makes an outage recoverable: if the cron is down for a week, the days
 * it missed are still sitting in `battle_samples`, and the next successful run
 * picks them up instead of losing them to the prune.
 *
 * Never throws, but never fails quietly either, and the difference matters
 * more than it looks. The prune refuses to advance past what has been rolled
 * up, so a run that cannot fold cannot delete — which is the right call for
 * the battles (they are unrecoverable) and a slow leak for the disk: sampling
 * keeps writing raw rows that nothing is now allowed to remove, at roughly
 * 35 MB a day. That is the one remaining path to a full database, and it would
 * otherwise look exactly like a healthy run. So the reason comes back with the
 * count, and the caller reports it.
 */
export async function rollUpBattles(): Promise<{ rows: number; error: string | null }> {
  const prisma = getPrisma();
  if (!prisma) return { rows: 0, error: null };

  const competitive = [...COMPETITIVE_BATTLE_TYPES];

  try {
    // Raw days worth folding: recent ones always, older ones only if they were
    // never folded. `day` is a DATE and `battle_time` a UTC timestamp, and the
    // session runs in GMT, so the cast lines the two grains up exactly.
    const days = await prisma.$queryRaw<{ day: Date; watermark: Date }[]>`
      WITH candidates AS (
        SELECT b.battle_time::date AS day, MAX(b.created_at) AS watermark
        FROM battle_samples b
        WHERE b.battle_time::date > current_date - ${ROLLUP_REBUILD_DAYS}::int
           OR NOT EXISTS (
             SELECT 1 FROM battle_daily_stats d WHERE d.day = b.battle_time::date
           )
        GROUP BY 1
      )
      -- Skip days no battle has been added to since they were last folded.
      -- The sampler only appends, so an unmoved watermark means the fold would
      -- write back exactly the rows already there — pure WAL, and on Neon WAL
      -- is billed storage. IS DISTINCT FROM rather than <>, so a day with no
      -- watermark row at all (never folded) still counts as changed.
      SELECT c.day, c.watermark
      FROM candidates c
      LEFT JOIN rollup_watermarks w ON w.day = c.day AND w.source = 'battles'
      WHERE w.raw_watermark IS DISTINCT FROM c.watermark
      ORDER BY c.day
    `;

    let rows = 0;

    for (const { day, watermark } of days) {
      // Delete-then-insert rather than upsert: `map_name` and `event_id` are
      // nullable, and a unique constraint over nullable columns does not
      // constrain anything useful in Postgres, where NULLs are distinct.
      //
      // Wrapped in a transaction so the pair is atomic. Apart is worse than
      // either alone: a DELETE that lands without its INSERT leaves the day
      // missing from the roll-up, and the site would read a hole in its window
      // until the next run noticed and refilled it.
      const [, battleRows] = await prisma.$transaction([
        prisma.$executeRaw`DELETE FROM battle_daily_stats WHERE day = ${day}`,
        prisma.$executeRaw`
        INSERT INTO battle_daily_stats
          (day, battle_type, mode, map_name, event_id, brawler_id, brawler_name,
           result, rank, battles, last_battle_time)
        SELECT battle_time::date, battle_type, mode, map_name, event_id, brawler_id,
               brawler_name, result, rank, COUNT(*), MAX(battle_time)
        FROM battle_samples
        WHERE battle_time::date = ${day}
        GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9
      `,
      ]);

      const [, playerRows] = await prisma.$transaction([
        prisma.$executeRaw`DELETE FROM player_battle_daily WHERE day = ${day}`,
        prisma.$executeRaw`
        INSERT INTO player_battle_daily
          (day, player_tag, brawler_id, battles, competitive_battles, wins, decided)
        SELECT battle_time::date, player_tag, brawler_id,
               COUNT(*),
               COUNT(*) FILTER (WHERE battle_type = ANY(${competitive}::text[])),
               COUNT(*) FILTER (WHERE result = 'victory'),
               COUNT(*) FILTER (WHERE result IN ('victory', 'defeat'))
        FROM battle_samples
        WHERE battle_time::date = ${day}
        GROUP BY 1, 2, 3
      `,
      ]);

      await prisma.$executeRaw`
        INSERT INTO rollup_watermarks (day, source, raw_watermark, folded_at)
        VALUES (${day}, 'battles', ${watermark}, now())
        ON CONFLICT (day, source)
        DO UPDATE SET raw_watermark = EXCLUDED.raw_watermark, folded_at = now()
      `;

      rows += battleRows + playerRows;
    }

    // Team samples are folded on their own day list: they are written only for
    // 3v3 battles, so a day can legitimately exist in one table and not the
    // other, and pairing the two loops would skip or redo days.
    const teamDays = await prisma.$queryRaw<{ day: Date; watermark: Date }[]>`
      WITH candidates AS (
        SELECT b.battle_time::date AS day, MAX(b.created_at) AS watermark
        FROM battle_team_samples b
        WHERE b.battle_time::date > current_date - ${ROLLUP_REBUILD_DAYS}::int
           OR NOT EXISTS (
             SELECT 1 FROM brawler_team_daily d WHERE d.day = b.battle_time::date
           )
        GROUP BY 1
      )
      SELECT c.day, c.watermark
      FROM candidates c
      LEFT JOIN rollup_watermarks w ON w.day = c.day AND w.source = 'teams'
      WHERE w.raw_watermark IS DISTINCT FROM c.watermark
      ORDER BY c.day
    `;

    for (const { day, watermark } of teamDays) {
      // One INSERT for both sides: `unnest` is applied twice over the same
      // scan rather than once per side, which halves the work on the table's
      // widest columns.
      const [, pairRows] = await prisma.$transaction([
        prisma.$executeRaw`DELETE FROM brawler_pair_daily WHERE day = ${day}`,
        prisma.$executeRaw`
        INSERT INTO brawler_pair_daily
          (day, brawler_id, other_brawler_id, side, result, battles)
        SELECT battle_time::date, brawler_id, other_id, side, result, COUNT(*)
        FROM battle_team_samples,
             LATERAL (
               SELECT unnest(enemy_brawler_ids) AS other_id, 'enemy' AS side
               UNION ALL
               SELECT unnest(ally_brawler_ids), 'ally'
             ) expanded
        WHERE battle_time::date = ${day}
          -- Mirrors carry no information: a brawler is 50% against itself by
          -- construction, and every read excluded them anyway.
          AND other_id <> brawler_id
        GROUP BY 1, 2, 3, 4, 5
      `,
      ]);

      const [, teamRows] = await prisma.$transaction([
        prisma.$executeRaw`DELETE FROM brawler_team_daily WHERE day = ${day}`,
        prisma.$executeRaw`
        INSERT INTO brawler_team_daily (day, brawler_id, wins, decided)
        SELECT battle_time::date, brawler_id,
               COUNT(*) FILTER (WHERE result = 'victory'),
               -- Every sampled team battle, draws included. Not a slip: the
               -- pairing rows are summed the same way, and every read reports
               -- a pairing as an edge against this baseline. Matching
               -- denominators is what makes that subtraction mean anything;
               -- excluding draws from one side and not the other would bias
               -- every matchup on the site by the draw rate.
               COUNT(*)
        FROM battle_team_samples
        WHERE battle_time::date = ${day}
        GROUP BY 1, 2
      `,
      ]);

      await prisma.$executeRaw`
        INSERT INTO rollup_watermarks (day, source, raw_watermark, folded_at)
        VALUES (${day}, 'teams', ${watermark}, now())
        ON CONFLICT (day, source)
        DO UPDATE SET raw_watermark = EXCLUDED.raw_watermark, folded_at = now()
      `;

      rows += pairRows + teamRows;
    }

    return { rows, error: null };
  } catch (err) {
    // Stale roll-ups are recoverable on the next run; an unnoticed run of them
    // is not, because the prune stays parked for as long as this keeps failing.
    return {
      rows: 0,
      error: err instanceof Error ? err.message : 'unknown roll-up failure',
    };
  }
}

/**
 * Deletes raw observations past their retention window.
 *
 * Without this the two biggest tables grow forever while only their most recent
 * weeks are ever read — at the sampling rate this file now runs at, that is
 * roughly a hundred thousand dead rows a week on a 512 MB free-tier database.
 *
 * Deliberately conservative: see RAW_BATTLE_RETENTION_DAYS. Nothing here can be
 * undone, because the game API serves only a player's last ~25 battles and has
 * no history endpoint at all — except under storage pressure, where a shorter
 * snapshot window is still preferable to a database that refuses writes.
 */
export async function pruneOldSamples(): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) return 0;

  const bytes = await databaseBytes();
  const windows = RETENTION_UNDER_PRESSURE[pressureFor(bytes)];

  const day = 86_400_000;
  const battleCutoff = new Date(Date.now() - RAW_BATTLE_RETENTION_DAYS * day);
  const snapshotCutoff = new Date(Date.now() - windows.snapshots * day);
  const rollupCutoff = new Date(Date.now() - windows.rollup * day);
  const pairingCutoff = new Date(Date.now() - windows.pairing * day);

  try {
    /*
     * Raw battles go only once their day exists in the roll-up.
     *
     * The clock says which days are old enough; this says which are actually
     * safe, and they are not the same question. A run that sampled fine but
     * failed to fold would otherwise delete the only copy of a day's battles,
     * and the game API has no history endpoint to re-read them from. Checking
     * costs one indexed anti-join and removes the only unrecoverable failure
     * in the pipeline.
     */
    const battles = await prisma.$executeRaw`
      DELETE FROM battle_samples
      WHERE battle_time < ${battleCutoff}
        AND EXISTS (
          SELECT 1 FROM battle_daily_stats d WHERE d.day = battle_time::date
        )
    `;
    // Same rule for the team rows, against their own roll-up: they are folded
    // on a separate day list, so a day can be safe in one table and not yet in
    // the other.
    const teams = await prisma.$executeRaw`
      DELETE FROM battle_team_samples
      WHERE battle_time < ${battleCutoff}
        AND EXISTS (
          SELECT 1 FROM brawler_team_daily d WHERE d.day = battle_time::date
        )
    `;

    const snapshots = await prisma.playerBrawlerSnapshot.deleteMany({
      where: { snapshotDate: { lt: snapshotCutoff } },
    });

    // The roll-ups themselves age out on the window the site reads. Nothing
    // guards these: they are derived, and a lost day costs a thinner average
    // rather than an unrecoverable observation.
    const [dailyStats, playerDaily, pairDaily, teamDaily] = await Promise.all([
      prisma.battleDailyStat.deleteMany({ where: { day: { lt: rollupCutoff } } }),
      prisma.playerBattleDaily.deleteMany({ where: { day: { lt: pairingCutoff } } }),
      prisma.brawlerPairDaily.deleteMany({ where: { day: { lt: pairingCutoff } } }),
      prisma.brawlerTeamDaily.deleteMany({ where: { day: { lt: pairingCutoff } } }),
    ]);

    return (
      battles +
      teams +
      snapshots.count +
      dailyStats.count +
      playerDaily.count +
      pairDaily.count +
      teamDaily.count
    );
  } catch {
    // A failed prune costs disk, not correctness, so it never fails a run.
    return 0;
  }
}

/**
 * Trims the pool back to POOL_TARGET, dropping the least useful members.
 *
 * Only removes the `sampled_players` row. Battle samples, brawler snapshots
 * and trophy history are all keyed by tag with no foreign key, so an evicted
 * player keeps every observation already recorded — they simply stop being
 * re-read. A tag can also come straight back on a later run if it re-enters
 * the top 200, or the moment anyone looks it up.
 *
 * Two groups are never evicted:
 *
 * - anyone in the current global top 200, which is the cohort the meta pages
 *   are explicitly about;
 * - anyone whose row came from a `lookup`, because a visitor asked for them by
 *   name and their trophy history only continues while they stay in the pool.
 *
 * Everyone else is ordered by whether they have produced a battle recently and
 * then by trophies, so the first to go are the accounts costing two API calls
 * a visit and returning nothing.
 */
export async function evictStalePool(protectedTags: string[]): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) return 0;

  const total = await prisma.sampledPlayer.count();
  const excess = total - POOL_TARGET;
  if (excess <= 0) return 0;

  const since = windowStartUtc(INACTIVE_AFTER_DAYS);
  // Read from the per-player roll-up, not the raw battles: raw rows only live
  // ROLLUP_REBUILD_DAYS now, which is far short of the fortnight this window
  // asks about. The roll-up carries the same counts for the full window at
  // about a twentieth of the storage, so eviction keeps judging members over
  // two weeks rather than over three days.
  const [activeGroups, competitiveGroups] = await Promise.all([
    prisma.playerBattleDaily.groupBy({
      by: ['playerTag'],
      where: { day: { gte: since } },
      _sum: { battles: true },
    }),
    /*
     * Who has actually queued competitive Ranked lately.
     *
     * The pool is seeded from the *trophy* leaderboard, so it fills with ladder
     * grinders: measured over a fortnight, competitive Ranked was 8.7k of the
     * 49k battles sampled. Every per-map ranking on the site is built from that
     * 18% slice, and it is split again across 27 maps and the whole roster — so
     * a map's evidence is the thinnest number on the site, and this is the only
     * lever that thickens it without spending another API call.
     *
     * The pool therefore drifts toward accounts that play Ranked: when it has
     * to shed members, a ladder-only player goes before a Ranked one.
     */
    prisma.playerBattleDaily.groupBy({
      by: ['playerTag'],
      where: { day: { gte: since }, competitiveBattles: { gt: 0 } },
      _sum: { competitiveBattles: true },
    }),
  ]);
  // Battles produced, not just whether any were: how much a member actually
  // contributes is what decides whether they earn their two API calls.
  const produced = new Map(activeGroups.map((g) => [g.playerTag, g._sum.battles ?? 0]));
  const competitive = new Set(competitiveGroups.map((g) => g.playerTag));
  const keep = new Set(protectedTags);

  /*
   * Lookups are protected while warm, not permanently.
   *
   * `player_trophy_points` is written by `recordLookup` and by nothing else, so
   * the newest row for a tag is exactly when that profile was last opened —
   * which makes it the recency signal without a column or a migration.
   */
  const lookupCutoff = new Date(Date.now() - LOOKUP_PROTECTION_DAYS * 86_400_000);
  const warmLookups = await prisma.playerTrophyPoint.groupBy({
    by: ['playerTag'],
    where: { recordedOn: { gte: lookupCutoff } },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: LOOKUP_PROTECTION_SLOTS,
  });
  for (const row of warmLookups) keep.add(row.playerTag);

  /*
   * Filtered here rather than in the query. The protected set is now the top
   * 200 plus every tag opened in a fortnight, which a crawl can push into the
   * thousands, and `NOT IN (...)` with thousands of literals is a query nobody
   * wants to plan. The pool itself is capped, so this reads about a thousand
   * rows either way.
   */
  const evictable = (
    await prisma.sampledPlayer.findMany({ select: { tag: true, trophies: true } })
  ).filter((row) => !keep.has(row.tag));

  const ordered = evictable
    .map((row) => ({
      ...row,
      battles: produced.get(row.tag) ?? 0,
      competitive: competitive.has(row.tag),
    }))
    .sort((a, b) => {
      // Silent accounts first: one producing nothing costs two API calls a
      // visit and returns no data at all.
      const aSilent = a.battles === 0;
      const bSilent = b.battles === 0;
      if (aSilent !== bSilent) return aSilent ? -1 : 1;
      // Then ladder-only before Ranked players, which is what tilts the pool
      // toward the competitive battles every per-map ranking is built from.
      if (a.competitive !== b.competitive) return a.competitive ? 1 : -1;
      /*
       * Then fewest battles produced, rather than fewest trophies.
       *
       * Trophies were the wrong tiebreaker and actively worked against the
       * pool: regional leaderboard entries sit far below the global top 200,
       * so ranking on trophies evicted every regionally-seeded account almost
       * as fast as seeding added it, and the pool converged back onto the same
       * few hundred high-trophy players. What the pool is for is battles, so
       * that is what decides who stays.
       */
      return a.battles - b.battles;
    })
    .slice(0, excess);

  if (ordered.length === 0) return 0;

  const result = await prisma.sampledPlayer.deleteMany({
    where: { tag: { in: ordered.map((row) => row.tag) } },
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

/**
 * Splits a team battle into the sampled player's side and the other one.
 *
 * Returns null for anything without exactly two teams — free-for-all showdown
 * has no "against", and a payload we cannot read confidently is better skipped
 * than guessed at. The subject's own brawler is excluded from `allies`, so a
 * brawler is never counted as its own team-mate.
 */
function splitSides(
  entry: BSBattleLogEntry,
  playerTag: string,
): { allies: number[]; enemies: number[] } | null {
  const teams = entry.battle.teams;
  if (!teams || teams.length !== 2) return null;

  const ownIndex = teams.findIndex((team) =>
    team.some((p) => normalizeTag(p.tag) === playerTag),
  );
  if (ownIndex === -1) return null;

  const brawlerIdsOf = (team: BSBattlePlayer[], skipTag?: string) =>
    team
      .filter((p) => !skipTag || normalizeTag(p.tag) !== skipTag)
      .map((p) => p.brawler?.id ?? p.brawlers?.[0]?.id)
      .filter((id): id is number => typeof id === 'number');

  return {
    allies: brawlerIdsOf(teams[ownIndex], playerTag),
    enemies: brawlerIdsOf(teams[ownIndex === 0 ? 1 : 0]),
  };
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
        hyperChargeIds: (b.hyperCharges ?? []).map((x) => x.id),
        buffieGadget: Boolean(b.buffies?.gadget),
        buffieStarPower: Boolean(b.buffies?.starPower),
        buffieHyperCharge: Boolean(b.buffies?.hyperCharge),
        // Equipped skin, including the default one. Base skins are filtered at
        // read time rather than dropped here, so the denominator stays honest:
        // "3% of players use this skin" needs to count the players who use
        // none.
        skinId: b.skin?.id ?? null,
        skinName: b.skin?.name ?? null,
        snapshotDate,
      })),
      skipDuplicates: true,
    });
  }

  // One battle sample per match, recording only this player's own brawler.
  const samples = [];
  // Team composition for the same battles, kept in its own list because it
  // only exists for team modes and is only ever read by matchup stats.
  const teamSamples = [];
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
      // Recorded so the ranked map pages can rank brawlers per map. Older
      // rows predate this and stay null, which those pages filter out.
      mapName: entry.event.map ?? null,
      eventId: entry.event.id ?? null,
      battleType: type,
      trophyChange: entry.battle.trophyChange ?? null,
      battleTime,
    });

    const sides = splitSides(entry, normalized);
    // Only team modes, and only decided ones: a draw pairs a brawler with an
    // opponent it neither beat nor lost to, which is not a matchup.
    if (sides && (entry.battle.result === 'victory' || entry.battle.result === 'defeat')) {
      teamSamples.push({
        battleKey: `${entry.battleTime}:${normalized}`,
        playerTag: normalized,
        brawlerId: brawler.id,
        result: entry.battle.result,
        mode: entry.battle.mode ?? entry.event.mode ?? 'unknown',
        mapName: entry.event.map ?? null,
        battleType: type,
        allyBrawlerIds: sides.allies,
        enemyBrawlerIds: sides.enemies,
        battleTime,
      });
    }
  }

  if (teamSamples.length > 0) {
    await prisma.battleTeamSample.createMany({
      data: teamSamples,
      skipDuplicates: true,
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
    data: {
      lastSampledAt: new Date(),
      name: player.name,
      trophies: player.trophies,
      iconId: player.icon?.id ?? null,
      rankedElo: player.rankedElo ?? null,
      rankedRankName: player.rankedRankName ?? null,
      highestRankedElo: player.highestAllTimeRankedElo ?? null,
      highestRankedRankName: player.highestAllTimeRankedRankName ?? null,
    },
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
  // Whole UTC days: both sources are keyed on a DATE, and a timestamp cutoff
  // against a date column quietly drops the oldest day. See `windowStartUtc`.
  const since = windowStartUtc(WINDOW_DAYS);

  // Run sequentially rather than in parallel: this executes once a day, and
  // serialising it keeps the job within a single connection, which matters on
  // connection-capped free-tier Postgres.
  //
  // Sourced from the daily roll-up rather than the raw battles, which no
  // longer reach back WINDOW_DAYS. The grain is the same one this already
  // grouped by, so the numbers are identical — `_sum: battles` replaces
  // `_count` because a roll-up row already stands for many battles.
  // Every battle, for pick rate.
  const battleGroups = await prisma.battleDailyStat.groupBy({
    by: ['brawlerId', 'brawlerName', 'result'],
    where: { day: { gte: since } },
    _sum: { battles: true },
  });

  // Competitive battles only, for win rate. See COMPETITIVE_BATTLE_TYPES.
  const competitiveGroups = await prisma.battleDailyStat.groupBy({
    by: ['brawlerId', 'brawlerName', 'result'],
    where: { day: { gte: since }, battleType: { in: [...COMPETITIVE_BATTLE_TYPES] } },
    _sum: { battles: true },
  });

  const ownerGroups = await prisma.playerBrawlerSnapshot.groupBy({
    by: ['brawlerId', 'brawlerName'],
    where: { snapshotDate: { gte: since } },
    _avg: { trophies: true, rank: true },
    _count: { _all: true },
  });

  const totalBattlesAgg = await prisma.battleDailyStat.aggregate({
    where: { day: { gte: since } },
    _sum: { battles: true },
  });
  const totalBattles = totalBattlesAgg._sum.battles ?? 0;

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
      const count = group._sum.battles ?? 0;

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
 * Held back for `recomputeBrawlerStats`, `recomputeBuildStats` and
 * `rollUpBattles`.
 *
 * All three scale with the number of battle samples in the trailing window, so
 * this reserve has to grow with the batch size. Starving them is the worst
 * possible failure: the samples land in the database but nothing turns them
 * into the rows the tier list actually reads.
 *
 * Raised from 40s when the roll-up joined this phase. Measured against a full
 * day of samples it folds three days in about 6s, so 55s keeps roughly the
 * same headroom over the phase as before rather than quietly spending the
 * recomputes' margin on it.
 */
const RECOMPUTE_RESERVE_MS = 55_000;

export async function runAggregation(batchSize = DEFAULT_BATCH_SIZE): Promise<AggregationResult> {
  const deadline = Date.now() + RUN_BUDGET_MS;
  const prisma = getPrisma();
  if (!prisma) {
    return {
      playersSampled: 0,
      battlesRecorded: 0,
      brawlersUpdated: 0,
      seeded: 0,
      evicted: 0,
      rolledUp: 0,
      pruned: 0,
      catalogChanges: 0,
      rankingsCached: 0,
      buildRowsUpdated: 0,
      status: 'failed',
      notes: 'DATABASE_URL is not set. Provision Neon before running the cron job.',
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

    const { seeded, ranked } = await seedSamplePool();

    // Seeding runs every time now, so the pool grows past its cap on any run
    // where the top 200 has moved. Trimming immediately keeps the revisit
    // interval — and therefore how many battles are lost between visits —
    // exactly where POOL_TARGET says it should be.
    const evicted = await evictStalePool(ranked).catch(() => 0);

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

    // Fold this run's raw battles into the daily roll-ups before anything is
    // deleted. The prune checks the roll-up's own contents rather than
    // assuming this succeeded, so the ordering is an optimisation and the
    // check is the guarantee.
    const rollUp = await rollUpBattles();

    // After the recomputes, so a prune can never remove rows the aggregates in
    // this same run were about to read.
    const pruned = await pruneOldSamples();

    // Last and time-boxed, because it is the most API-expensive step. It gets
    // whatever is left of the run budget and resumes where it stopped on the
    // next run, so a short night costs freshness rather than correctness.
    const remainingMs = Math.max(RANKING_MIN_BUDGET_MS, deadline - Date.now());
    const rankingsCached = await refreshBrawlerRankings(remainingMs).catch(() => 0);

    // A run that sampled cleanly but could not fold is not an 'ok' run: it has
    // left the prune unable to delete anything it collected.
    const status: AggregationResult['status'] =
      fulfilled.length === 0 ? 'failed' : failures === 0 && !rollUp.error ? 'ok' : 'partial';

    /*
     * Storage goes in the audit trail on every run, not just when it is a
     * problem. This project is meant to run unattended and free, and the one
     * way it can actually break is filling a 512 MB disk — so the number that
     * would explain that afterwards is recorded before it happens, next to the
     * run that caused it.
     */
    const bytes = await databaseBytes();
    const pressure = pressureFor(bytes);
    const storage =
      bytes === null
        ? null
        : `db ${(bytes / 1_048_576).toFixed(0)}MB (${((bytes / DATA_BUDGET_BYTES) * 100).toFixed(0)}% of data budget; history is billed on top)` +
          // Named only when it is not 'ok', so the common case stays quiet and
          // a shortened window never happens silently: if the site is serving
          // ten days of matchups instead of twenty-four, the run that decided
          // that says so.
          (pressure === 'ok' ? '' : ` · storage pressure: ${pressure}, windows tightened`);

    /*
     * A stalled roll-up outranks the sampling summary, because it is the more
     * expensive failure: samples that fail are simply missing, whereas a fold
     * that fails parks the prune and starts filling the disk.
     */
    const rollUpNote = rollUp.error ? `roll-up FAILED (${rollUp.error})` : null;

    const failureNote =
      failures > 0
        ? `${failures} of ${results.length} player samples failed (${[...reasons]
            .map(([code, count]) => `${code}: ${count}`)
            .join(', ')})`
        : null;

    const notes =
      [rollUpNote, failureNote, storage].filter(Boolean).join(' · ') || undefined;

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
      evicted,
      rolledUp: rollUp.rows,
      pruned,
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
