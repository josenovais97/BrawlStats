import 'server-only';

import { cached } from '@/lib/cached';
import { getBrawlerStatsForRange, normalizeWinRate } from '@/lib/stats';
import {
  type ChangeCategory,
  type ReleaseNotes,
  changesFromNotes,
  getReleaseNotes,
  monthSlugsBackFrom,
} from '@/lib/release-notes';

/**
 * What an update actually did, measured.
 *
 * Supercell publishes which brawlers it changed. Nobody publishes whether the
 * change worked, because answering it needs months of sampled battles either
 * side of a date — which is the one thing this site has and a wiki scrape
 * cannot produce. `/meta` already lists the names in an update; this is the
 * part that was missing.
 *
 * The claim is deliberately narrow. This does not say a patch caused a
 * movement: the map rotation turns over in the same weeks, a brawler can be
 * buffed and then ignored, and a fortnight is a fortnight. What it says is
 * "this is what the number did after the change", with the sample size next to
 * it, which is a fact rather than an inference. The page says so in those
 * words too.
 */

/** Days either side of the update date that get compared. */
export const PATCH_WINDOW_DAYS = 14;

/**
 * Decided battles a brawler needs on BOTH sides before its move is published.
 *
 * Not the tier list's floor of 20, which exists to decide whether a brawler can
 * be rated at all. This is a *difference* of two estimates, and a difference is
 * shakier than either side: at 500 decided battles a win rate carries a
 * standard error of about 2.2 points, so the difference carries about 3.2 --
 * which is why `NOTABLE_DELTA` sits where it does. At the sampling rate since
 * 2026-08-30 a fortnight gives the average brawler a few thousand decided
 * battles, so this excludes the thin tail rather than the roster.
 */
export const PATCH_MIN_DECIDED = 500;

/**
 * The two windows must be sampled at comparable rates, or nothing is published.
 *
 * This guard is the reason the page exists in the state it does, and it was
 * learned from the data rather than anticipated. Ranked sampling went from
 * ~1,538 battles a day to ~27,217 on 2026-08-30, when the player pool tripled
 * and the sampler moved to two hours. That date falls inside the before-window
 * of the September update, so the update appears to have moved brawlers by up
 * to nine points -- Gus read +8.9 off 253 decided battles before and 24,348
 * after. Most of that is the sampler, not Supercell.
 *
 * A win rate is supposed to be rate-invariant, and the adjusted rate does
 * control for the cohort's overall level. What it cannot control for is the
 * variance of a thin side, or a change in who is being sampled. So rather than
 * publishing a number with a caveat nobody reads, a patch whose windows differ
 * by more than this ratio is not scored at all, and the page says why.
 */
export const MAX_SAMPLING_RATIO = 3;

/**
 * And each side has to be more than a rounding error in absolute terms.
 *
 * The August 2026 update has both windows entirely before the sampling change
 * and clears the ratio test comfortably -- on 35 and 83 decided battles across
 * the whole roster. A ratio test alone would have called that comparable.
 */
export const MIN_WINDOW_DECIDED = 20_000;

/**
 * Only categories that can move a win rate count as "changed".
 *
 * The same list `getBalanceEvents` uses, and for the same reason: a brawler
 * named under "new skins" has not been changed, and putting it on a scoreboard
 * of balance impact would be a false cause.
 */
const MEASURED: ChangeCategory[] = ['balance', 'buffies', 'hypercharges'];

export interface PatchMovement {
  brawlerId: number;
  brawlerName: string;
  categories: ChangeCategory[];
  /** Adjusted win rate in the fortnight before the update. Null if unsampled. */
  before: number | null;
  /** The same, after. */
  after: number | null;
  /** Percentage points, after minus before. Null when either side is null. */
  delta: number | null;
  /** Pick-rate movement, in percentage points. */
  usageDelta: number | null;
  /** The smaller of the two decided-battle counts: what the delta rests on. */
  sampleSize: number;
}

export interface PatchImpact {
  slug: string;
  title: string;
  url: string;
  /** ISO date the update was published. */
  date: string;
  /** The compared ranges, as ISO dates, for the page to state plainly. */
  before: { start: string; end: string };
  after: { start: string; end: string };
  /** Every measured brawler, biggest absolute movement first. */
  movements: PatchMovement[];
  /**
   * Brawlers the update named that could not be measured — released after the
   * window, or too thinly sampled either side. Listed rather than dropped: a
   * scoreboard that silently omits what it could not measure is a scoreboard
   * that looks more complete than it is.
   */
  unmeasured: string[];
  /** True once the after-window has fully elapsed. */
  complete: boolean;
  /**
   * Whether the two windows can be compared at all, and why not when they
   * cannot. `movements` is empty whenever this is false: the page shows the
   * reason instead of a table, because a measurement nobody should trust is
   * worse than no measurement.
   */
  comparable: boolean;
  reason: string | null;
  /** Decided battles behind each window, across the whole roster. */
  decided: { before: number; after: number };
}

/**
 * A movement worth calling out rather than noise.
 *
 * Roughly the standard error of the difference at `PATCH_MIN_DECIDED`, so a
 * brawler at the floor needs a full standard error before it is highlighted,
 * and a well-sampled one needs two or three. Below this the row is still
 * listed -- the reader asked what the patch did, and "almost nothing" is an
 * answer -- but it is not coloured as a move.
 */
export const NOTABLE_DELTA = 2.5;

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shift(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

/**
 * Measures one update.
 *
 * `known` is the brawler catalogue, which `changesFromNotes` matches names
 * against; passing it in rather than fetching it keeps this module free of the
 * catalogue's own upstreams and lets the page fetch it once for every patch.
 */
async function computeImpact(
  notes: ReleaseNotes,
  known: { id: number; name: string }[],
  now: Date,
): Promise<PatchImpact | null> {
  if (!notes.publishedAt) return null;
  const date = notes.publishedAt.slice(0, 10);

  const changed = changesFromNotes(
    notes,
    known.map((b) => b.name),
  ).filter((c) => MEASURED.includes(c.category));
  if (changed.length === 0) return null;

  /** Name -> the categories that named it, so one brawler is one row. */
  const categories = new Map<string, ChangeCategory[]>();
  for (const { category, brawlers } of changed) {
    for (const name of brawlers) {
      categories.set(name, [...(categories.get(name) ?? []), category]);
    }
  }

  const before = { start: shift(date, -PATCH_WINDOW_DAYS), end: date };
  // The update day itself belongs to neither side: a patch lands mid-day and
  // that day's battles are a mix of both versions.
  const after = { start: shift(date, 1), end: shift(date, 1 + PATCH_WINDOW_DAYS) };

  const [beforeRows, afterRows] = await Promise.all([
    getBrawlerStatsForRange(before.start, before.end, 'ranked'),
    getBrawlerStatsForRange(after.start, after.end, 'ranked'),
  ]);

  const byId = (rows: Awaited<ReturnType<typeof getBrawlerStatsForRange>>) =>
    new Map(rows.map((r) => [r.brawlerId, r]));
  const beforeById = byId(beforeRows);
  const afterById = byId(afterRows);
  const idByName = new Map(known.map((b) => [b.name.toLowerCase(), b.id]));

  const totalDecided = (rows: Awaited<ReturnType<typeof getBrawlerStatsForRange>>) =>
    rows.reduce((sum, r) => sum + r.decidedSampleSize, 0);
  const decided = { before: totalDecided(beforeRows), after: totalDecided(afterRows) };

  const thin = Math.min(decided.before, decided.after);
  const thick = Math.max(decided.before, decided.after);
  const ratio = thin > 0 ? thick / thin : Infinity;

  let reason: string | null = null;
  if (thin < MIN_WINDOW_DECIDED) {
    reason =
      `Too little was sampled either side of this update to measure it: ` +
      `${decided.before.toLocaleString()} decided Ranked battles before and ` +
      `${decided.after.toLocaleString()} after.`;
  } else if (ratio > MAX_SAMPLING_RATIO) {
    reason =
      `The two windows were sampled at very different rates — ` +
      `${decided.before.toLocaleString()} decided Ranked battles before against ` +
      `${decided.after.toLocaleString()} after, a factor of ${ratio.toFixed(0)}. ` +
      `Any difference would be partly the sampling and not the update, so nothing is scored.`;
  }

  if (reason !== null) {
    return {
      slug: notes.slug,
      title: notes.title,
      url: notes.url,
      date,
      before,
      after,
      movements: [],
      unmeasured: [...categories.keys()].sort((x, y) => x.localeCompare(y)),
      complete: new Date(`${after.end}T00:00:00Z`) <= now,
      comparable: false,
      reason,
      decided,
    };
  }

  const movements: PatchMovement[] = [];
  const unmeasured: string[] = [];

  for (const [name, cats] of categories) {
    const id = idByName.get(name.toLowerCase());
    if (id === undefined) {
      unmeasured.push(name);
      continue;
    }

    const b = beforeById.get(id);
    const a = afterById.get(id);
    const bDecided = b?.decidedSampleSize ?? 0;
    const aDecided = a?.decidedSampleSize ?? 0;

    // Both sides need enough evidence to be worth subtracting. The tier list's
    // own floor is the right one: below it these pages already decline to rate
    // a brawler at all, and a difference of two numbers is shakier than either.
    if (bDecided < PATCH_MIN_DECIDED || aDecided < PATCH_MIN_DECIDED) {
      unmeasured.push(name);
      continue;
    }

    const beforeRate = normalizeWinRate(b!.winRate, b!.baselineWinRate, bDecided);
    const afterRate = normalizeWinRate(a!.winRate, a!.baselineWinRate, aDecided);

    movements.push({
      brawlerId: id,
      brawlerName: name,
      categories: cats,
      before: beforeRate,
      after: afterRate,
      delta:
        beforeRate !== null && afterRate !== null ? (afterRate - beforeRate) * 100 : null,
      usageDelta:
        b!.usageRate !== null && a!.usageRate !== null
          ? (a!.usageRate - b!.usageRate) * 100
          : null,
      sampleSize: Math.min(bDecided, aDecided),
    });
  }

  movements.sort((x, y) => Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0));
  unmeasured.sort((x, y) => x.localeCompare(y));

  return {
    slug: notes.slug,
    title: notes.title,
    url: notes.url,
    date,
    before,
    after,
    movements,
    unmeasured,
    complete: new Date(`${after.end}T00:00:00Z`) <= now,
    comparable: true,
    reason: null,
    decided,
  };
}

export const getPatchImpact = cached(
  'patch-impact',
  async (slug: string, known: { id: number; name: string }[], nowIso: string) => {
    const notes = await getReleaseNotes(slug);
    if (!notes) return null;
    return computeImpact(notes, known, new Date(nowIso));
  },
  // A patch's numbers stop moving once its after-window closes, and until then
  // they move once a day at most. Six hours is well inside that and keeps the
  // page off the database on almost every render.
  21_600,
);

/**
 * How far back a scoreboard can go.
 *
 * Bounded by `ROLLUP_RETENTION_DAYS` (120) in `lib/aggregation`, which is what
 * `battle_daily_stats` keeps — the before-window of an older update has simply
 * been pruned, and measuring it would silently compare a fortnight against
 * nothing. Four months is about four monthly updates, and the number grows on
 * its own as the roll-up fills rather than by being raised here.
 */
export const MEASURABLE_DAYS = 120;

/** The update slugs a scoreboard can still measure, newest first. */
export function measurableSlugs(now = new Date()): string[] {
  const oldest = new Date(now);
  oldest.setUTCDate(oldest.getUTCDate() - MEASURABLE_DAYS + PATCH_WINDOW_DAYS);
  // One extra month back: an update published on the 1st still has its whole
  // before-window inside retention.
  return monthSlugsBackFrom(now, 5).filter((slug) => {
    const [month, year] = slug.split('-');
    const at = new Date(`${year}-${monthNumber(month)}-01T00:00:00Z`);
    return at >= new Date(`${iso(oldest).slice(0, 7)}-01T00:00:00Z`);
  });
}

function monthNumber(name: string): string {
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  return String(months.indexOf(name) + 1).padStart(2, '0');
}
