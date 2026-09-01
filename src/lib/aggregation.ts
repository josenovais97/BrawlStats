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
import { ALL_REGIONS, POPULAR_REGION_CODES } from '@/lib/regions';
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
 * Consecutive upstream failures that mean the game API is down, not unlucky.
 *
 * Fifty is far past what jitter produces at a concurrency of five — a healthy
 * run's failures are isolated deleted accounts, which reset the count — while
 * an outage reaches it within seconds. Set it much lower and a brief wobble
 * abandons a good run; much higher and the saving disappears.
 */
const UPSTREAM_FAILURE_STREAK = 50;

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
 * reintroduce the partial coverage that was losing battles — so this number
 * and `RUN_BUDGET_MS` only ever move together.
 *
 * Raised 1,000 -> 3,000 on 2026-08-31, with the plateau re-derived rather than
 * assumed. Disk was never the binding constraint: 248 MB of the 289 MB in the
 * database is in tables whose retention (8-45 days) has already elapsed, so it
 * was already at steady state; only ~22 MB was still filling toward the
 * 120-day roll-up window. Tripling the pool projects to ~2.25 GB against an
 * 8 GB budget — 28%, where `pressureFor` does not begin defending until 80%.
 *
 * The real limit was time. Sampling gets RUN_BUDGET_MS minus the ranking and
 * recompute reserves, which was 530s, and 1,000 players took 127s on a good
 * run and 340s on a slow one. Three thousand at the slow rate is ~1,020s, so
 * the budget went to 25 minutes — still inside the unit's 30-minute
 * TimeoutStartSec, with the margin left deliberately.
 *
 * Time rather than concurrency, deliberately: raising CONCURRENCY would hold
 * the wall clock flat but triple the request *rate* against an API key that is
 * IP-locked to one proxy. Spending more wall clock is the cheaper risk.
 *
 * Breadth still comes from *which* accounts are in the pool as much as from
 * how many: see `seedSamplePool`, which draws on regional leaderboards as well
 * as the global one.
 */
export const POOL_TARGET = 3000;

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
 *
 * Derived from POOL_TARGET rather than repeated, and declared after it for
 * that reason. Raising the pool on 2026-08-31 while this still said 1000 left
 * a 2,336-member pool being read a thousand at a time — the revisit interval
 * silently tripled, which is exactly the battle loss described above, arrived
 * at by a change meant to improve coverage.
 */
const DEFAULT_BATCH_SIZE = POOL_TARGET;

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
const ROLLUP_RETENTION_DAYS = 120;

/*
 * Raised from 30 on 2026-08-27, when the database moved onto the box's own
 * disk and STORAGE_LIMIT_BYTES stopped being someone else's free tier.
 *
 * `battle_daily_stats` costs ~97 KB/day measured, so 120 days is ~12 MB --
 * against an 8 GB budget this is free, and it is the cheapest roll-up by an
 * order of magnitude. Retention no longer has to be argued down to what is
 * read *today*: a longer window is now something the site can choose to read
 * rather than something storage forbids.
 */

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
const PAIRING_ROLLUP_RETENTION_DAYS = 45;

/*
 * Raised from 22 on 2026-08-27. Still deliberately shorter than the roll-up
 * above -- one battle becomes several pairings, so this table grows ~4x faster
 * (~429 KB/day measured, ~19 MB at 45 days). The margin over the 21-day read
 * is now two dozen days rather than one, which is the point: the old value sat
 * one day clear of the deepest read, so any new window that reached further
 * would have silently returned thinner data rather than failing.
 */

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
const RAW_BATTLE_RETENTION_DAYS = 14;

/*
 * Decoupled from ROLLUP_REBUILD_DAYS on 2026-08-27, and raised from 3 to 14.
 *
 * The invariant is one-directional: raw retention must be >= the rebuild
 * window, or the fold has no source to rebuild from. Keeping it *longer* than
 * the rebuild window costs storage and buys recovery, which is the trade the
 * 512 MB ceiling could not afford and 8 GB can. Measured ~15 MB/day of raw
 * across both tables, so 14 days is ~215 MB.
 *
 * Worth buying because this is the only irreplaceable data in the system. The
 * roll-ups are derived and can be rebuilt from raw; raw cannot be rebuilt from
 * anything, because the game API serves a player's last ~25 battles and has no
 * history endpoint. At three days, a fold that broke on a Friday and went
 * unnoticed over a weekend would have destroyed battles permanently. At
 * fourteen there is a fortnight to notice -- and since 2026-08-27 a failed run
 * also emails, so noticing is no longer a matter of luck.
 */

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
export const SNAPSHOT_RETENTION_DAYS = 8;

/*
 * Raised from 2 on 2026-08-27, for a correctness reason rather than a storage
 * one: `getMetaMovers(7)` asks for a week of snapshot-to-snapshot movement,
 * and with two days kept it silently compared against yesterday instead. It
 * did not error -- reaching past retention never does, it just returns a
 * thinner answer, which is the same trap the tier list's old "30d" option fell
 * into. Eight days gives the seven that read wants plus a day of margin.
 *
 * The old comment justified two days as "four runs, since runs are twice
 * daily". Runs have been eight times daily for some time and are twelve from
 * 2026-08-27, so that arithmetic had drifted badly: two days is now sixteen
 * runs of margin, not four.
 *
 * Still the largest table -- one row per sampled player per brawler per day --
 * but SNAPSHOT_SAMPLE_RATE keeps it to a rotating quarter of the pool, so this
 * is ~12 MB/day and ~96 MB at eight days.
 */

/**
 * Write a brawler snapshot for one sampled player in this many.
 *
 * `player_brawler_snapshots` was 192.6 MB of a 400 MB database — 47% of
 * everything stored — because `samplePlayer` wrote a row per brawler per
 * player on every run: roughly 7,000 players a day times ~57 brawlers, or
 * 399,186 rows at ~482 bytes each.
 *
 * Nothing reads an individual row. Every consumer is an aggregate over the
 * population — mean trophies and mean rank per brawler, the share of owners
 * holding each gadget or star power, which skins and icons are equipped. Those
 * are distributions, and a distribution needs a representative sample, not a
 * census. Measuring the mean trophies of a brawler across 7,000 players a day
 * rather than 1,750 buys precision far below the width of the thing being
 * measured, and pays 145 MB for it.
 *
 * So the census becomes a sample. At 4 this holds the table near 48 MB, which
 * is what takes the database from ~80% of a 0.5 GB plan to roughly half of it.
 *
 * Deliberately NOT a cut to sampling itself. Battles are what the tier lists
 * are built from and what the sample floors are drawn against — 105 of 106
 * brawlers clear MIN_SAMPLE_FOR_TIER over seven days at the current rate, and
 * 28 of 106 over one. Sampling fewer players, or running less often, would
 * degrade the numbers the site exists to publish. This costs none of that: the
 * battle log of every sampled player is still read and recorded in full.
 */
const SNAPSHOT_SAMPLE_RATE = 4;

/**
 * Whether this player's roster is recorded on this day.
 *
 * Keyed on the day as well as the tag so the cohort rotates: a stable hash of
 * the tag alone would pick the same eighth of the pool forever, which is a
 * fixed panel rather than a sample, and would let one unusual account sit in
 * or out of every aggregate indefinitely.
 *
 * FNV-1a because it needs to be deterministic across runs and processes and
 * nothing here justifies a dependency. It is not a security boundary.
 *
 * The finaliser is not optional, and the day goes first for the same reason.
 * FNV-1a's low bits are weak: its last step is a multiply, so `% rate` on the
 * raw hash is decided almost entirely by the final byte of the key. With the
 * date on the end and a rate of 4, consecutive days produced *perfectly
 * disjoint* cohorts — a four-day rotation in lockstep rather than a sample.
 * The avalanche below spreads that entropy across all 32 bits.
 */
export function shouldSnapshot(tag: string, day: Date, rate = SNAPSHOT_SAMPLE_RATE): boolean {
  if (rate <= 1) return true;

  const key = `${day.toISOString().slice(0, 10)}:${tag}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  // fmix32, from MurmurHash3.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;

  return (hash >>> 0) % rate === 0;
}

/**
 * A pool member producing no battles in this many days is inactive.
 *
 * They still cost two API calls per visit and contribute nothing, so they are
 * the first thing evicted when the pool is over its cap.
 */
const INACTIVE_AFTER_DAYS = 14;

/**
 * How long a player's daily trophy readings are kept.
 *
 * This table was the one thing here with no ceiling. Every other table is
 * bounded by a retention window and plateaus; `player_trophy_points` was
 * written by `recordLookup` on every profile view and pruned by nothing, so it
 * only ever grew — measured on Neon at 178,080 rows over eleven days, about
 * 2.65 MB a day, which reaches a 500 MB plan on its own inside seven months.
 *
 * Most of that was crawlers walking profile pages, which `robots.txt` now
 * disallows, so the rate should fall sharply. That fixes the slope and not the
 * shape: an unbounded table on a fixed plan is a deadline either way.
 *
 * 120 days because `getTrophyHistory` reads 90 and nothing reads further back
 * — everything past that was stored and never looked at. The extra month is
 * margin, so a chart at the edge of its window is never trimmed by a rounding
 * difference between the reader and the prune.
 */
const TROPHY_POINT_RETENTION_DAYS = 120;

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
const REGIONS_PER_RUN = 18;

/**
 * The order regions are walked in: the deep boards first, then everything else.
 *
 * Popular first so a cold pool fills from the leaderboards that actually have
 * 200 entries, rather than spending its first days on regions that return a
 * dozen. Past that the long tail is the point — a mid-table player in a small
 * country is exactly the account the global board never contains, and the
 * sample has been badly skewed toward the top: median 128,580 trophies, with
 * 875 of the first 1,000 members above 50,000.
 */
const REGION_ROTATION_CODES: readonly string[] = [
  ...POPULAR_REGION_CODES,
  ...ALL_REGIONS.map((r) => r.code).filter(
    (code) => !POPULAR_REGION_CODES.includes(code as (typeof POPULAR_REGION_CODES)[number]),
  ),
];
const REGION_ROTATION_MS = 2 * 3600_000;

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
   * run would be ~250 calls, so a window rotates and the whole list is covered
   * over a day or so.
   *
   * That last sentence was aspirational until 2026-08-31. The rotation ran
   * over POPULAR_REGION_CODES — 21 countries — so "the whole list" was the
   * same 4,200 leaderboard slots forever, and once the pool held them seeding
   * found nothing new: measured at 1 new player in a run, against 1,288 the
   * run before. It now rotates over every supported region.
   *
   * Two smaller faults went with it. The offset advanced by one per rotation
   * while the window was six wide, so consecutive windows overlapped by five;
   * it now advances by a full window. And the rotation period was four hours
   * against a two-hour sampler, so every second run re-read boards it had just
   * read; the two now match.
   */
  const rotation = Math.floor(Date.now() / REGION_ROTATION_MS);
  const start = (rotation * REGIONS_PER_RUN) % REGION_ROTATION_CODES.length;
  const regions = Array.from(
    { length: REGIONS_PER_RUN },
    (_, i) => REGION_ROTATION_CODES[(start + i) % REGION_ROTATION_CODES.length],
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
 * Retargeted 2026-08-27 when Postgres moved onto the Oracle A1 box. It was
 * 500 MB, which was never a property of this project — it was Neon's free
 * tier, then Supabase's. Self-hosted on a 45 GB volume the real constraint is
 * the *disk*, shared with Docker images, build cache and the nightly dumps,
 * so the ceiling is now a slice of that rather than someone else's plan limit.
 *
 * 8 GB, derived rather than picked. Measured on the box 2026-08-27, every
 * table is window-bounded and the whole database plateaus near 150 MB:
 *
 *   battle_daily_stats   ~97 KB/day  x 30d  =  ~2.9 MB
 *   brawler_pair_daily  ~429 KB/day  x 22d  =  ~9.4 MB
 *   battle_samples       ~10 MB/day  x  3d  =   ~30 MB
 *   player_brawler_snapshots, 2d                ~24 MB
 *   the rest, all bounded                       ~80 MB
 *
 * So 8 GB is ~50x the plateau: the valve becomes an emergency brake for a
 * genuine runaway rather than something that fires during normal operation,
 * which is what it was doing at 500 MB. It is deliberately NOT the whole disk
 * — a database allowed to fill the volume takes Docker, the deploy timer and
 * the backups down with it, which is strictly worse than shortening a window.
 *
 * Note that raising this does not lengthen retention by itself. The `ok` row
 * of RETENTION_UNDER_PRESSURE is what bounds history, and at ~98 MB the valve
 * is already idle. Widening those windows is a separate decision about what
 * the site shows, and AGENTS.md asks for the plateau to be re-derived first.
 *
 * Above the high-water mark the prune shortens its retention windows instead,
 * spending accuracy to hold the line — see RETENTION_UNDER_PRESSURE for which
 * windows, in which order, and what each one costs.
 *
 * Tightening costs accuracy, not correctness: every window it touches is one
 * where the data is still there, just shallower. Nothing it does can lose an
 * observation that cannot be re-derived, which is why the raw battle window is
 * the one thing it will not touch.
 */
const STORAGE_LIMIT_BYTES = 8 * 1024 * 1024 * 1024;

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
/*
 * Retargeted from Neon to Supabase on 2026-08-25.
 *
 * The reserve existed because Neon billed "Storage" as the database *plus*
 * retained WAL, and only the first half is visible from inside Postgres — so
 * the valve was given a budget below the limit to cover the half it could not
 * see. Supabase bills database size alone, which `pg_database_size` reports
 * directly, so that blind spot is gone.
 *
 * Kept at a smaller figure rather than dropped to zero. A valve that only
 * begins defending at the plan limit has no room to act in: freeing pages does
 * not shrink a Postgres file, and the rewrite that does needs somewhere to
 * write the copy. This is that somewhere.
 */
const HISTORY_RESERVE_BYTES = 25 * 1024 * 1024;
export const DATA_BUDGET_BYTES = STORAGE_LIMIT_BYTES - HISTORY_RESERVE_BYTES;

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
  // Scaled with the baselines on 2026-08-27. These stay meaningful reductions
  // rather than fixed numbers that happen to sit below the new defaults --
  // `critical` still serves the 21-day matchup and 30-day tier-list reads, so
  // even the tightest state degrades accuracy rather than emptying a feature.
  high: { snapshots: 4, pairing: 30, rollup: 60 },
  critical: { snapshots: 2, pairing: 22, rollup: 30 },
};

/**
 * A floor no roll-up retention window may go below, whatever the pressure.
 *
 * The roll-ups are the only copy. Raw battles live three days, and the game
 * API serves a player's last ~25 battles with no history endpoint, so once a
 * day ages out of raw its roll-up row is the sole record that it happened —
 * measured 2026-08-24, 24 of 28 roll-up days had no raw copy left.
 *
 * That was survivable while Neon kept a day of history to rewind through. With
 * point-in-time recovery set to zero it is not: a mistyped constant here would
 * delete weeks of irreplaceable aggregates on the next cron run, unattended and
 * unrecoverable. The fold cannot cause that — it only ever rewrites days that
 * still exist in raw — so the prune is the whole risk surface, and this is the
 * cheapest possible guard on it.
 *
 * Seven days is well under every window the valve legitimately uses (the
 * tightest is `critical`, at 10), so it never interferes with real pressure
 * handling. It exists purely to turn "someone set this to 0" from a disaster
 * into a clamp and a note in the run log.
 */
const MIN_ROLLUP_RETENTION_DAYS = 7;

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
  // Clamped, not trusted. See MIN_ROLLUP_RETENTION_DAYS: these two windows
  // delete the only surviving copy of their data, so they are the one place
  // where a wrong number cannot be walked back.
  const rollupDays = Math.max(windows.rollup, MIN_ROLLUP_RETENTION_DAYS);
  const pairingDays = Math.max(windows.pairing, MIN_ROLLUP_RETENTION_DAYS);
  const clamped = rollupDays !== windows.rollup || pairingDays !== windows.pairing;

  const battleCutoff = new Date(Date.now() - RAW_BATTLE_RETENTION_DAYS * day);
  const snapshotCutoff = new Date(Date.now() - windows.snapshots * day);
  const rollupCutoff = new Date(Date.now() - rollupDays * day);
  const pairingCutoff = new Date(Date.now() - pairingDays * day);

  if (clamped) {
    // Not thrown: a clamp means the prune is about to do the *safe* thing, and
    // failing the run would only stop the sampling that pays for the site.
    console.error(
      `[prune] roll-up retention below the ${MIN_ROLLUP_RETENTION_DAYS}-day floor ` +
        `(rollup=${windows.rollup}, pairing=${windows.pairing}); clamped. Check the retention constants.`,
    );
  }

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

    // The only table here that grows without a window of its own. Kept well
    // past what any chart reads — see TROPHY_POINT_RETENTION_DAYS.
    const trophyPoints = await prisma.playerTrophyPoint.deleteMany({
      where: {
        recordedOn: {
          lt: new Date(Date.now() - TROPHY_POINT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
        },
      },
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
      trophyPoints.count +
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

/**
 * Removes accounts the game says do not exist.
 *
 * Eviction otherwise only fires when the pool is *over* `POOL_TARGET`, and it
 * sits exactly at it — so a deleted account held its slot forever. Measured
 * 2026-08-28: the same 12 tags failed every run, wasting 1.2% of the sample and
 * putting an identical, permanent failure line in every log.
 *
 * Capped per run rather than trusting the codes blindly. A 404 for one tag is
 * certain, but a bad deploy or an upstream fault answering 404 to everything
 * would otherwise empty the pool in a single run, and re-seeding a thousand
 * players is far more expensive than carrying a dead tag for another two hours.
 * Above the cap it evicts nothing and says so, because a wave of 404s is a
 * story about the API rather than about these accounts.
 */
const MAX_MISSING_EVICTIONS = 0.05;

async function evictDeletedAccounts(tags: string[], sampled: number): Promise<number> {
  if (tags.length === 0) return 0;

  const prisma = getPrisma();
  if (!prisma) return 0;

  const cap = Math.max(1, Math.floor(sampled * MAX_MISSING_EVICTIONS));
  if (tags.length > cap) {
    console.warn(
      `[aggregation] ${tags.length} tags reported missing, above the ${cap} cap — ` +
        'evicting none, since that looks like an upstream fault rather than deletions',
    );
    return 0;
  }

  try {
    const result = await prisma.sampledPlayer.deleteMany({ where: { tag: { in: tags } } });
    return result.count;
  } catch {
    // A failed eviction costs a wasted slot until the next run, nothing more.
    return 0;
  }
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
  //
  // Only a rotating fraction of players, and only this write — the battle log
  // below is still recorded for everyone. See SNAPSHOT_SAMPLE_RATE.
  if (player.brawlers.length > 0 && shouldSnapshot(normalized, snapshotDate)) {
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
 * Was 270s, and that number was never about the work — it was Vercel's Hobby
 * function ceiling of 300s, minus 30s so the response still got written. The
 * sampler does not run on Vercel any more (.github/workflows/refresh-stats.yml
 * runs it in the runner), so the ceiling that chose this value is gone.
 *
 * Ten minutes, sitting under the job's own `timeout-minutes: 15`. The first CI
 * run made the case: 438 of 1,000 player samples timed out against 8 on the
 * same code from a local machine twelve minutes earlier, and the run hit the
 * budget having sampled 560 players instead of 992. GitHub's runners are a
 * slower path to the API than Vercel's fra1 was, and the old budget left no
 * room to absorb that.
 *
 * Affordable because the repository is public, where Actions minutes are
 * unmetered. On a private repo this would be ~2,400 minutes a month against a
 * 2,000 allowance, and the frequency would have to come down to pay for it.
 */
const RUN_BUDGET_MS = 1_500_000;

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
 * day of samples it folds three days in about 6s, so 55s per thousand players
 * keeps roughly the same headroom over the phase as before rather than quietly
 * spending the recomputes' margin on it.
 *
 * Scaled off the batch rather than fixed, because the sentence above is a rule
 * and a constant is not: it said the reserve has to grow with the batch, and
 * then did not when the batch grew.
 */
const RECOMPUTE_RESERVE_MS = 55_000 * (DEFAULT_BATCH_SIZE / 1000);

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
    /*
     * Stop early when the game API is down rather than working the whole pool.
     *
     * Supercell takes the API down for every update, and on 2026-09-01 a run
     * spent 1,329 seconds failing all 3,000 players — 1,280 upstream-down and
     * 1,720 timeouts — before giving up. Tripling the pool tripled that waste,
     * and on two shared cores a day-long maintenance costs hours of CPU spent
     * on calls that cannot succeed.
     *
     * Counted consecutively, and reset by any success. That distinguishes an
     * outage from ordinary bad luck: scattered timeouts never accumulate,
     * while a dead API produces an unbroken run of them immediately. Counting
     * consecutively also catches an API that dies mid-run, which a check on
     * the first N players only would miss.
     *
     * The circuit throws per player rather than aborting the whole map, which
     * is the same shape the deadline check above uses: every remaining player
     * fails instantly with no network call, so the run still reports a
     * complete set of results and the notes still say what went wrong.
     */
    let consecutiveUpstreamFailures = 0;
    let circuitOpen = false;

    const results = await mapLimit(targets, CONCURRENCY, async (t) => {
      if (Date.now() > samplingDeadline) {
        throw new BrawlApiError('timeout', 'Run budget exhausted before sampling this player');
      }
      if (circuitOpen) {
        throw new BrawlApiError('upstreamDown', 'Upstream is down; run abandoned early');
      }
      try {
        const sampled = await samplePlayer(t.tag);
        consecutiveUpstreamFailures = 0;
        return sampled;
      } catch (error) {
        const code = toApiError(error).code;
        if (code === 'upstreamDown' || code === 'timeout') {
          consecutiveUpstreamFailures += 1;
          if (consecutiveUpstreamFailures >= UPSTREAM_FAILURE_STREAK) circuitOpen = true;
        } else {
          // A deleted account is not evidence about the API's health.
          consecutiveUpstreamFailures = 0;
        }
        throw error;
      }
    });

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const battlesRecorded = fulfilled.reduce(
      (sum, r) => sum + (r as PromiseFulfilledResult<{ battles: number }>).value.battles,
      0,
    );
    const failures = results.length - fulfilled.length;

    // Group failure reasons so a bad run says *why*, not just how many.
    const reasons = new Map<string, number>();
    const gone: string[] = [];
    for (const [index, result] of results.entries()) {
      if (result.status === 'rejected') {
        const code = toApiError(result.reason).code;
        reasons.set(code, (reasons.get(code) ?? 0) + 1);
        // `withRetry` already treats these as permanent: a 404 for a deleted
        // account never becomes a 200. Collected here so they can leave the
        // pool -- see `evictDeletedAccounts`.
        if (code === 'notFound' || code === 'invalidTag') {
          const tag = targets[index]?.tag;
          if (tag) gone.push(tag);
        }
      }
    }

    const evictedMissing = await evictDeletedAccounts(gone, targets.length);

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

    // Say that the run was cut short, not just that calls failed: the two look
    // identical in a count of error codes, and only one of them means the box
    // stopped spending CPU on an API that could not answer.
    const abandonedNote = circuitOpen
      ? `upstream down — run abandoned after ${UPSTREAM_FAILURE_STREAK} consecutive failures`
      : null;

    const failureNote =
      failures > 0
        ? `${failures} of ${results.length} player samples failed (${[...reasons]
            .map(([code, count]) => `${code}: ${count}`)
            .join(', ')})` +
          (evictedMissing > 0 ? ` · ${evictedMissing} deleted account(s) removed from the pool` : '') +
          (abandonedNote ? ` · ${abandonedNote}` : '')
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
