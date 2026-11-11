/**
 * A player's trophy-ladder games worked out for the profile's Trophies tab
 * (2026-11-11). Pure, so it tests without a database.
 *
 * Two sources: per-day totals per brawler (player_battle_daily, every game,
 * about 45 days) for counts and win rates, and single games (raw
 * battle_samples, about two weeks, plus the live battle log) for the trophy
 * change, modes, maps, Showdown places, streaks and hours.
 */

import { battleModeOf } from '@/lib/battle-mode';
import { logTime } from '@/lib/ranked-season';
import type { PlayerActivityRow, TrophyGameRow } from '@/lib/stats';
import type { BSBattleLogEntry } from '@/types/brawlstars';

export type TrophyGame = TrophyGameRow;

const sameTag = (a: string, b: string) => a.replace(/^#/, '').toUpperCase() === b.replace(/^#/, '').toUpperCase();

/** The trophy-ladder games in a battle log ("ranked" is the ladder's type). */
export function trophyGamesFromLog(entries: BSBattleLogEntry[], playerTag: string): TrophyGame[] {
  const out: TrophyGame[] = [];
  for (const entry of entries) {
    const battle = entry.battle;
    if (battle?.type !== 'ranked') continue;
    const time = logTime(entry.battleTime);
    if (time === null) continue;
    const people = [...(battle.teams ?? []).flat(), ...(battle.players ?? [])];
    const me = people.find((p) => sameTag(p.tag, playerTag));
    const brawler = me?.brawler ?? me?.brawlers?.[0];
    if (!brawler) continue;
    out.push({
      time,
      brawlerId: brawler.id,
      result: battle.result ?? null,
      rank: battle.rank ?? null,
      mode: battleModeOf(entry),
      map: entry.event?.map ?? null,
      trophyChange: typeof battle.trophyChange === 'number' ? battle.trophyChange : null,
    });
  }
  return out;
}

/** Stored and log games together, newest first, one per game (matched on time). */
export function mergeTrophyGames(stored: TrophyGame[], log: TrophyGame[]): TrophyGame[] {
  const seen = new Set(stored.map((g) => Math.round(g.time / 1000)));
  return [...stored, ...log.filter((g) => !seen.has(Math.round(g.time / 1000)))].sort((a, b) => b.time - a.time);
}

export interface TrophyTally {
  games: number;
  wins: number;
  decided: number;
  /** Net trophy change. */
  net: number;
  /** Showdown places, for an average. */
  places: number[];
}

const empty = (): TrophyTally => ({ games: 0, wins: 0, decided: 0, net: 0, places: [] });

function add(t: TrophyTally, g: TrophyGame) {
  t.games += 1;
  if (g.result === 'victory' || g.result === 'defeat') {
    t.decided += 1;
    if (g.result === 'victory') t.wins += 1;
  }
  t.net += g.trophyChange ?? 0;
  if (typeof g.rank === 'number') t.places.push(g.rank);
}

export const avgPlace = (t: TrophyTally): number | null =>
  t.places.length ? t.places.reduce((a, b) => a + b, 0) / t.places.length : null;

export interface TrophyBreakdown extends TrophyTally {
  won: number;
  lost: number;
  since: number | null;
  brawlers: (TrophyTally & { brawlerId: number })[];
  modes: (TrophyTally & { key: string })[];
  maps: (TrophyTally & { key: string; mode: string })[];
  days: (TrophyTally & { day: string })[];
  longestWin: number;
  current: number;
}

/** Everything the single games say, most played first. */
export function trophyBreakdown(games: TrophyGame[]): TrophyBreakdown {
  const total = empty();
  const brawlers = new Map<number, TrophyTally>();
  const modes = new Map<string, TrophyTally>();
  const maps = new Map<string, TrophyTally & { mode: string }>();
  const days = new Map<string, TrophyTally>();
  let won = 0;
  let lost = 0;
  for (const g of games) {
    add(total, g);
    if ((g.trophyChange ?? 0) > 0) won += g.trophyChange!;
    if ((g.trophyChange ?? 0) < 0) lost -= g.trophyChange!;
    const b = brawlers.get(g.brawlerId) ?? empty();
    add(b, g);
    brawlers.set(g.brawlerId, b);
    const m = modes.get(g.mode) ?? empty();
    add(m, g);
    modes.set(g.mode, m);
    if (g.map) {
      const k = `${g.mode}\u0000${g.map}`;
      const mp = maps.get(k) ?? { ...empty(), mode: g.mode };
      add(mp, g);
      maps.set(k, mp);
    }
    const day = new Date(g.time).toISOString().slice(0, 10);
    const d = days.get(day) ?? empty();
    add(d, g);
    days.set(day, d);
  }
  // Streaks over the games that have a win or a loss, oldest first.
  let run = 0;
  let longestWin = 0;
  for (const g of [...games].sort((a, b) => a.time - b.time)) {
    if (g.result !== 'victory' && g.result !== 'defeat') continue;
    run = g.result === 'victory' ? (run > 0 ? run + 1 : 1) : run < 0 ? run - 1 : -1;
    if (run > longestWin) longestWin = run;
  }
  const byGames = <T extends TrophyTally>(a: T, b: T) => b.games - a.games || b.net - a.net;
  return {
    ...total,
    won,
    lost,
    since: games.length ? Math.min(...games.map((g) => g.time)) : null,
    brawlers: [...brawlers].map(([brawlerId, t]) => ({ brawlerId, ...t })).sort(byGames),
    modes: [...modes].map(([key, t]) => ({ key, ...t })).sort(byGames),
    maps: [...maps].map(([k, t]) => ({ ...t, key: k.split('\u0000')[1] })).sort(byGames),
    days: [...days].map(([day, t]) => ({ day, ...t })).sort((a, b) => a.day.localeCompare(b.day)),
    longestWin,
    current: run,
  };
}

/** Trophy games per day from the per-day rows (every game minus Ranked). */
export function trophyDays(rows: PlayerActivityRow[]): { day: string; games: number; wins: number; decided: number }[] {
  const by = new Map<string, { day: string; games: number; wins: number; decided: number }>();
  for (const r of rows) {
    const d = by.get(r.day) ?? { day: r.day, games: 0, wins: 0, decided: 0 };
    d.games += r.battles - r.rankedBattles;
    d.wins += r.wins - r.rankedWins;
    d.decided += r.decided - r.rankedDecided;
    by.set(r.day, d);
  }
  return [...by.values()].filter((d) => d.games > 0).sort((a, b) => a.day.localeCompare(b.day));
}

/** The best of `rows` by `score` among those with at least `min` games. */
export function bestBy<T extends { games: number }>(rows: T[], min: number, score: (r: T) => number | null): T | null {
  const ok = rows.filter((r) => r.games >= min && score(r) !== null);
  if (ok.length < 2) return null;
  return [...ok].sort((a, b) => (score(b) ?? 0) - (score(a) ?? 0) || b.games - a.games)[0];
}
