/**
 * The daily Shadow and Zoom puzzles inside Discord, as `/daily` (2026-10-23).
 *
 * The bot answers over HTTP and keeps no session, so a game's state rides in
 * the buttons themselves: each custom_id carries the puzzle, the day and the
 * misses so far. A player can only press what Discord shows them, and nothing
 * in an id names the answer -- the picture is the site's own
 * /api/brawldle/picture, which never does either.
 *
 * Pure, so the encoding can be tested; the route does the talking.
 */

export type DailyMode = 'shadow' | 'zoom';
export const DAILY_TRIES = 6;

export type DailyAction = 'guess' | 'answer' | 'share';
const CODE: Record<DailyAction, string> = { guess: 'g', answer: 'm', share: 's' };
const ACTION: Record<string, DailyAction> = { g: 'guess', m: 'answer', s: 'share' };

export interface DailyRef {
  action: DailyAction;
  mode: DailyMode;
  date: string;
  /** Wrong guesses so far; for `share`, the finished result (0 = lost). */
  n: number;
}

export function encodeDaily(ref: DailyRef): string {
  return ['dly', CODE[ref.action], ref.mode, ref.date, ref.n].join(':');
}

export function decodeDaily(id: string): DailyRef | null {
  const [tag, code, mode, date, n] = id.split(':');
  const num = Number(n);
  if (tag !== 'dly' || !ACTION[code] || (mode !== 'shadow' && mode !== 'zoom')) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(num) || num < 0 || num > DAILY_TRIES) return null;
  return { action: ACTION[code], mode, date, n: num };
}

/** #1 was 2026-10-02, as on the site's share card. */
export function dailyNumber(date: string): number {
  return Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.UTC(2026, 9, 1)) / 86_400_000);
}

export function hearts(misses: number): string {
  return '❤️'.repeat(Math.max(0, DAILY_TRIES - misses)) + '🖤'.repeat(Math.min(DAILY_TRIES, misses));
}

/** "🟥🟥🟩" for solved in 3, six red for lost: the same squares as the site's share. */
export function squares(solvedIn: number): string {
  return solvedIn > 0 ? '🟥'.repeat(solvedIn - 1) + '🟩' : '🟥'.repeat(DAILY_TRIES);
}
