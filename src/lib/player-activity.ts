/**
 * One player's last 30 days, every mode, from player_battle_daily rows
 * (lib/stats `getPlayerActivity`). Pure, so it tests without a database.
 *
 * Win rates count 3v3 wins and losses only: a Showdown place is neither, so
 * Showdown games add to the battle count and not to the rate.
 */

import { dayRange } from '@/lib/ranked-season';
import type { PlayerActivityRow } from '@/lib/stats';

export interface Tally {
  battles: number;
  wins: number;
  decided: number;
}

export interface ActivityDay extends Tally {
  day: string;
  ranked: number;
}

export interface ActivityBrawler extends Tally {
  brawlerId: number;
  ranked: Tally;
  trophy: Tally;
}

export interface ActivitySummary {
  all: Tally;
  ranked: Tally;
  trophy: Tally;
  /** Every day of the window, oldest first, zeros included. */
  days: ActivityDay[];
  /** Most played first. */
  brawlers: ActivityBrawler[];
  played: number;
}

const zero = (): Tally => ({ battles: 0, wins: 0, decided: 0 });

export const rate = (t: Tally): number | null => (t.decided > 0 ? t.wins / t.decided : null);

export function summarizeActivity(rows: PlayerActivityRow[], from: string, to: string): ActivitySummary {
  const all = zero();
  const ranked = zero();
  const byDay = new Map<string, ActivityDay>(dayRange(from, to).map((day) => [day, { day, ranked: 0, ...zero() }]));
  const byBrawler = new Map<number, ActivityBrawler>();

  for (const r of rows) {
    all.battles += r.battles;
    all.wins += r.wins;
    all.decided += r.decided;
    ranked.battles += r.rankedBattles;
    ranked.wins += r.rankedWins;
    ranked.decided += r.rankedDecided;

    const d = byDay.get(r.day);
    if (d) {
      d.battles += r.battles;
      d.wins += r.wins;
      d.decided += r.decided;
      d.ranked += r.rankedBattles;
    }

    const b = byBrawler.get(r.brawlerId) ?? { brawlerId: r.brawlerId, ...zero(), ranked: zero(), trophy: zero() };
    b.battles += r.battles;
    b.wins += r.wins;
    b.decided += r.decided;
    b.ranked.battles += r.rankedBattles;
    b.ranked.wins += r.rankedWins;
    b.ranked.decided += r.rankedDecided;
    byBrawler.set(r.brawlerId, b);
  }

  const brawlers = [...byBrawler.values()]
    .map((b) => ({
      ...b,
      trophy: { battles: b.battles - b.ranked.battles, wins: b.wins - b.ranked.wins, decided: b.decided - b.ranked.decided },
    }))
    .filter((b) => b.battles > 0)
    .sort((a, b) => b.battles - a.battles || b.wins - a.wins);
  const days = [...byDay.values()];

  return {
    all,
    ranked,
    trophy: { battles: all.battles - ranked.battles, wins: all.wins - ranked.wins, decided: all.decided - ranked.decided },
    days,
    brawlers,
    played: days.filter((d) => d.battles > 0).length,
  };
}

/** Per-brawler totals for the grid's "Played" sort and tile line. */
export function brawlerTotals(rows: PlayerActivityRow[]): Map<number, Tally> {
  const out = new Map<number, Tally>();
  for (const r of rows) {
    const t = out.get(r.brawlerId) ?? zero();
    t.battles += r.battles;
    t.wins += r.wins;
    t.decided += r.decided;
    out.set(r.brawlerId, t);
  }
  return out;
}
