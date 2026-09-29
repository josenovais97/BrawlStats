/**
 * Streaks and totals for the daily challenge.
 *
 * Pure and separate from the board so it can be tested. Streak arithmetic is
 * the sort of thing that looks obviously right and is wrong at the edges — a
 * player who solves two puzzles on the same day, one who comes back after a
 * week, one whose clock crosses midnight UTC mid-game — and every one of those
 * bugs is invisible until somebody's streak resets and they stop playing.
 *
 * Nothing is stored server-side. There is no account, so a streak lives in one
 * browser and is lost with it, which is the same bargain the board makes.
 */

export interface DailyStats {
  played: number;
  won: number;
  streak: number;
  best: number;
  /** Guess count → how many times the puzzle was solved in that many. */
  distribution: Record<number, number>;
  /** The last date recorded, so a second result for one day cannot double-count. */
  lastDate: string | null;
  /** The last date WON, which is what a streak is actually counted on. */
  lastWon: string | null;
}

export const EMPTY_STATS: DailyStats = {
  played: 0,
  won: 0,
  streak: 0,
  best: 0,
  distribution: {},
  lastDate: null,
  lastWon: null,
};

/** Whole days between two YYYY-MM-DD strings, or null if either is unparseable. */
export function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Fold one finished puzzle into the totals.
 *
 * Idempotent per date: recording the same day twice changes nothing. The board
 * saves on every guess and a solved board can be re-rendered, so without this
 * a refresh would inflate the counts.
 *
 * A streak continues only when the previous WIN was the day before. A loss
 * does not continue it and a skipped day does not either — that is the whole
 * meaning of a streak, and counting `played` instead would make it a
 * participation medal.
 */
export function recordResult(
  stats: DailyStats,
  date: string,
  won: boolean,
  guesses: number,
): DailyStats {
  if (stats.lastDate === date) return stats;

  const gap = stats.lastWon ? daysBetween(stats.lastWon, date) : null;
  const streak = won ? (gap === 1 ? stats.streak + 1 : 1) : 0;

  return {
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    streak,
    best: Math.max(stats.best, streak),
    distribution: won
      ? { ...stats.distribution, [guesses]: (stats.distribution[guesses] ?? 0) + 1 }
      : stats.distribution,
    lastDate: date,
    lastWon: won ? date : stats.lastWon,
  };
}

/**
 * The streak as it should be *displayed* today.
 *
 * Stored streaks go stale: win on Monday, open the page on Thursday, and the
 * stored number still says 1 although the run is plainly over. The stored
 * value is the record of what happened; this is what is true now, and showing
 * the stored one would be a small lie that the next win would quietly correct.
 */
export function currentStreak(stats: DailyStats, today: string): number {
  if (!stats.lastWon) return 0;
  const gap = daysBetween(stats.lastWon, today);
  if (gap === null || gap < 0) return stats.streak;
  // Today (0) or yesterday (1) means the run is still alive: a run is not
  // broken until a day passes with no win, and today is not over yet.
  return gap <= 1 ? stats.streak : 0;
}

/** Mean guesses across solved puzzles, or null before the first win. */
export function averageGuesses(stats: DailyStats): number | null {
  const entries = Object.entries(stats.distribution);
  if (entries.length === 0) return null;
  let total = 0;
  let count = 0;
  for (const [guesses, times] of entries) {
    total += Number(guesses) * times;
    count += times;
  }
  return count === 0 ? null : total / count;
}

/** Solved on the first guess. Worth its own number because it is a brag. */
export function oneShots(stats: DailyStats): number {
  return stats.distribution[1] ?? 0;
}

/** Milliseconds until the next puzzle, which resets at midnight UTC. */
export function msUntilReset(now: Date): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(0, next - now.getTime());
}

export function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
