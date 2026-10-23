/**
 * Everybody's results for the day's challenge (2026-10-23), as counts: how many
 * players finished each puzzle in how many guesses. It is what lets a board say
 * "38% solved today's Zoom", which turns a private result into one worth
 * sharing.
 *
 * Pure, so it can be tested; the routes under /api/brawldle/tally do the
 * storing. Nothing identifies a player: a finished puzzle bumps a counter.
 */

export type TallyMode = 'classic' | 'shadow' | 'zoom';
export const TALLY_MODES: readonly TallyMode[] = ['classic', 'shadow', 'zoom'];

/** Picture puzzles allow six guesses; the classic board has no limit, so a ceiling stops nonsense. */
const PICTURE_TRIES = 6;
const CLASSIC_MAX = 40;

/**
 * The counter a finished puzzle goes into, or null for a result no real board
 * can produce. 0 is a lost picture puzzle; the classic board cannot be lost.
 */
export function tallyBucket(mode: string, solved: boolean, guesses: number): number | null {
  if (!Number.isInteger(guesses) || guesses < 1) return null;
  if (mode === 'classic') return solved && guesses <= CLASSIC_MAX ? guesses : null;
  if (mode !== 'shadow' && mode !== 'zoom') return null;
  if (solved) return guesses <= PICTURE_TRIES ? guesses : null;
  return guesses === PICTURE_TRIES ? 0 : null;
}

export interface ModeTally {
  players: number;
  solved: number;
  /** Average guesses among those who solved it, or null before anyone has. */
  average: number | null;
}

export type DayTally = Record<TallyMode, ModeTally>;

export function summarize(rows: { mode: string; guesses: number; count: number }[]): DayTally {
  const out = Object.fromEntries(TALLY_MODES.map((m) => [m, { players: 0, solved: 0, average: null }])) as DayTally;
  const sums: Record<string, number> = {};
  for (const r of rows) {
    const t = out[r.mode as TallyMode];
    if (!t || r.count <= 0) continue;
    t.players += r.count;
    if (r.guesses > 0) {
      t.solved += r.count;
      sums[r.mode] = (sums[r.mode] ?? 0) + r.guesses * r.count;
    }
  }
  for (const m of TALLY_MODES) {
    if (out[m].solved > 0) out[m].average = Math.round(((sums[m] ?? 0) / out[m].solved) * 10) / 10;
  }
  return out;
}

/** Below this many players a percentage says more about chance than about the puzzle. */
export const TALLY_MIN_PLAYERS = 5;
