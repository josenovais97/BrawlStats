/**
 * A player's Ranked season, worked out for the profile's Ranked tab
 * (2026-11-10). Pure functions over plain rows, so they test without a
 * database: the reads live in lib/stats (`getPlayerRankedSeason`).
 *
 * Two sources, and they answer different questions:
 * - per-day totals per brawler (player_battle_daily) cover the whole season
 *   for any account the sampler visits: games, wins, top brawlers, the
 *   calendar;
 * - single games (raw battle_team_samples, kept about two weeks, plus the live
 *   battle log) carry mode, map, team-mates, opponents and time of day.
 */

import { battleModeOf } from '@/lib/battle-mode';
import type { BSBattleLogEntry } from '@/types/brawlstars';

export const RANKED_TYPES = new Set(['soloRanked', 'teamRanked']);

/** One decided Ranked game from the player's side. */
export interface RankedGame {
  /** Epoch ms. */
  time: number;
  brawlerId: number;
  win: boolean;
  mode: string;
  map: string | null;
  allies: number[];
  enemies: number[];
}

export interface SeasonDay {
  /** YYYY-MM-DD, UTC. */
  day: string;
  games: number;
  wins: number;
}

export interface Record3 {
  games: number;
  wins: number;
}

export interface BrawlerRecord extends Record3 {
  brawlerId: number;
}

export interface KeyedRecord extends Record3 {
  key: string;
}

/** "20261110T082531.000Z" -> epoch ms, or null. */
export function logTime(value: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.(\d{3}))?Z$/.exec(value ?? '');
  if (!m) return null;
  const [, y, mo, d, h, mi, s, ms = '000'] = m;
  const t = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}Z`);
  return Number.isFinite(t) ? t : null;
}

const sameTag = (a: string, b: string) => a.replace(/^#/, '').toUpperCase() === b.replace(/^#/, '').toUpperCase();

/** The decided Ranked games in a battle log, from `playerTag`'s side. */
export function gamesFromLog(entries: BSBattleLogEntry[], playerTag: string): RankedGame[] {
  const out: RankedGame[] = [];
  for (const entry of entries) {
    const battle = entry.battle;
    if (!RANKED_TYPES.has(battle?.type ?? '')) continue;
    if (battle.result !== 'victory' && battle.result !== 'defeat') continue;
    const time = logTime(entry.battleTime);
    const teams = battle.teams ?? [];
    const mine = teams.find((team) => team.some((p) => sameTag(p.tag, playerTag)));
    const me = mine?.find((p) => sameTag(p.tag, playerTag));
    if (time === null || !mine || !me?.brawler) continue;
    out.push({
      time,
      brawlerId: me.brawler.id,
      win: battle.result === 'victory',
      mode: battleModeOf(entry),
      map: entry.event?.map ?? null,
      allies: mine.filter((p) => p !== me).map((p) => p.brawler?.id).filter((id): id is number => typeof id === 'number'),
      enemies: teams
        .filter((team) => team !== mine)
        .flat()
        .map((p) => p.brawler?.id)
        .filter((id): id is number => typeof id === 'number'),
    });
  }
  return out;
}

/**
 * Stored games plus the log's newer ones, newest first, one entry per game.
 * The log overlaps the last sample, so games are matched on their time.
 */
export function mergeGames(stored: RankedGame[], log: RankedGame[]): RankedGame[] {
  const seen = new Set(stored.map((g) => Math.round(g.time / 1000)));
  const extra = log.filter((g) => !seen.has(Math.round(g.time / 1000)));
  return [...stored, ...extra].sort((a, b) => b.time - a.time);
}

/** Season totals per brawler with the log's unsampled games added on. */
export function addGamesToBrawlers(base: BrawlerRecord[], extra: RankedGame[]): BrawlerRecord[] {
  const by = new Map(base.map((r) => [r.brawlerId, { ...r }]));
  for (const g of extra) {
    const row = by.get(g.brawlerId) ?? { brawlerId: g.brawlerId, games: 0, wins: 0 };
    row.games += 1;
    row.wins += g.win ? 1 : 0;
    by.set(g.brawlerId, row);
  }
  return sortRecords([...by.values()]);
}

/** Most played first; wins break ties. */
export function sortRecords<T extends Record3>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.games - a.games || b.wins - a.wins);
}

function tally<K>(games: RankedGame[], keys: (g: RankedGame) => K[]): Map<K, Record3> {
  const out = new Map<K, Record3>();
  for (const g of games) {
    for (const key of keys(g)) {
      const row = out.get(key) ?? { games: 0, wins: 0 };
      row.games += 1;
      row.wins += g.win ? 1 : 0;
      out.set(key, row);
    }
  }
  return out;
}

export const winRate = (r: Record3) => (r.games > 0 ? r.wins / r.games : 0);

/** Streaks over games in time order (oldest first is not required). */
export function streaks(games: RankedGame[]): { longestWin: number; longestLoss: number; current: number } {
  const ordered = [...games].sort((a, b) => a.time - b.time);
  let longestWin = 0;
  let longestLoss = 0;
  let run = 0;
  for (const g of ordered) {
    run = g.win ? (run > 0 ? run + 1 : 1) : run < 0 ? run - 1 : -1;
    if (run > longestWin) longestWin = run;
    if (-run > longestLoss) longestLoss = -run;
  }
  return { longestWin, longestLoss, current: run };
}

export interface GameBreakdown {
  games: number;
  wins: number;
  /** Oldest game's time, epoch ms. */
  since: number | null;
  modes: KeyedRecord[];
  maps: (KeyedRecord & { mode: string })[];
  /** Team-mates' brawlers, best record first (min `minPair` games). */
  allies: BrawlerRecord[];
  /** Opponents' brawlers, worst record first: the ones that beat you. */
  enemies: BrawlerRecord[];
  streaks: { longestWin: number; longestLoss: number; current: number };
}

/**
 * Everything the single games say. Pairs need `minPair` games before they
 * are listed: one game beside a Mortis is not a finding.
 */
export function breakdown(games: RankedGame[], minPair = 3, minMap = 2): GameBreakdown {
  const modes = tally(games, (g) => [g.mode]);
  const maps = tally(games, (g) => (g.map ? [`${g.mode}\u0000${g.map}`] : []));
  const allies = tally(games, (g) => [...new Set(g.allies)]);
  const enemies = tally(games, (g) => [...new Set(g.enemies)]);
  const wins = games.filter((g) => g.win).length;
  const since = games.length ? Math.min(...games.map((g) => g.time)) : null;

  return {
    games: games.length,
    wins,
    since,
    modes: sortRecords([...modes].map(([key, r]) => ({ key, ...r }))),
    maps: sortRecords(
      [...maps]
        .filter(([, r]) => r.games >= minMap)
        .map(([key, r]) => {
          const [mode, map] = key.split('\u0000');
          return { key: map, mode, ...r };
        }),
    ),
    allies: [...allies]
      .filter(([, r]) => r.games >= minPair)
      .map(([brawlerId, r]) => ({ brawlerId, ...r }))
      .sort((a, b) => winRate(b) - winRate(a) || b.games - a.games),
    enemies: [...enemies]
      .filter(([, r]) => r.games >= minPair)
      .map(([brawlerId, r]) => ({ brawlerId, ...r }))
      .sort((a, b) => winRate(a) - winRate(b) || b.games - a.games),
    streaks: streaks(games),
  };
}

/** Every day from `from` to `to` inclusive (YYYY-MM-DD, UTC). */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end && out.length < 120; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** The day before an exclusive end date. */
export function dayBefore(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** Season days with games, plus the log's unsampled games on their UTC day. */
export function addGamesToDays(days: SeasonDay[], extra: RankedGame[]): SeasonDay[] {
  const by = new Map(days.map((d) => [d.day, { ...d }]));
  for (const g of extra) {
    const day = new Date(g.time).toISOString().slice(0, 10);
    const row = by.get(day) ?? { day, games: 0, wins: 0 };
    row.games += 1;
    row.wins += g.win ? 1 : 0;
    by.set(day, row);
  }
  return [...by.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export interface DayFacts {
  played: number;
  busiest: SeasonDay | null;
  /** Most wins minus losses in one day. */
  best: SeasonDay | null;
  /** Longest run of consecutive days with a game. */
  longestRun: number;
}

export function dayFacts(days: SeasonDay[]): DayFacts {
  const played = days.filter((d) => d.games > 0).sort((a, b) => a.day.localeCompare(b.day));
  let busiest: SeasonDay | null = null;
  let best: SeasonDay | null = null;
  let longestRun = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of played) {
    if (!busiest || d.games > busiest.games) busiest = d;
    const net = d.wins * 2 - d.games;
    if (net > 0 && (!best || net > best.wins * 2 - best.games)) best = d;
    const t = Date.parse(`${d.day}T00:00:00Z`);
    run = prev !== null && t - prev === 86_400_000 ? run + 1 : 1;
    prev = t;
    if (run > longestRun) longestRun = run;
  }
  return { played: played.length, busiest, best, longestRun };
}

/**
 * The brawler with the best record among those played enough to mean it:
 * at least 10 games and a twentieth of the season, so a 3-0 pocket pick does
 * not win the award.
 */
export function bestBrawler(rows: BrawlerRecord[], total: number): BrawlerRecord | null {
  const floor = Math.max(10, Math.ceil(total / 20));
  const eligible = rows.filter((r) => r.games >= floor);
  if (eligible.length < 2) return null;
  return [...eligible].sort((a, b) => winRate(b) - winRate(a) || b.games - a.games)[0];
}

/** Best record among keyed rows with at least `min` games. */
export function bestKeyed<T extends Record3>(rows: T[], min: number): T | null {
  const eligible = rows.filter((r) => r.games >= min);
  if (eligible.length < 2) return null;
  return [...eligible].sort((a, b) => winRate(b) - winRate(a) || b.games - a.games)[0];
}

export interface SeasonView {
  /** Whether the per-day table had any Ranked games for this season. */
  hasSeason: boolean;
  brawlers: BrawlerRecord[];
  days: SeasonDay[];
  games: number;
  wins: number;
  /** Stored and log games together, newest first. */
  recent: RankedGame[];
  detail: GameBreakdown;
  /** Whole days the single games reach back. */
  detailDays: number;
}

/**
 * The season as the tab shows it. The per-day rows stop at the sampler's last
 * visit, so the log's games after the newest stored game are added on top;
 * with no rows at all, the log is all there is.
 */
export function seasonView(
  rows: { day: string; brawlerId: number; games: number; wins: number }[],
  stored: RankedGame[],
  logGames: RankedGame[],
  now: number = Date.now(),
): SeasonView {
  const hasSeason = rows.length > 0;
  const storedSeconds = new Set(stored.map((g) => Math.round(g.time / 1000)));
  const newestStored = stored.length ? Math.max(...stored.map((g) => g.time)) : now - 10 * 86_400_000;
  const extra = hasSeason
    ? logGames.filter((g) => g.time > newestStored && !storedSeconds.has(Math.round(g.time / 1000)))
    : logGames;

  const byBrawler = new Map<number, BrawlerRecord>();
  const byDay = new Map<string, SeasonDay>();
  for (const r of rows) {
    const b = byBrawler.get(r.brawlerId) ?? { brawlerId: r.brawlerId, games: 0, wins: 0 };
    b.games += r.games;
    b.wins += r.wins;
    byBrawler.set(r.brawlerId, b);
    const d = byDay.get(r.day) ?? { day: r.day, games: 0, wins: 0 };
    d.games += r.games;
    d.wins += r.wins;
    byDay.set(r.day, d);
  }
  const brawlers = addGamesToBrawlers([...byBrawler.values()], extra);
  const days = addGamesToDays([...byDay.values()], extra);
  const recent = mergeGames(stored, logGames);
  const detail = breakdown(recent);
  return {
    hasSeason,
    brawlers,
    days,
    games: brawlers.reduce((n, b) => n + b.games, 0),
    wins: brawlers.reduce((n, b) => n + b.wins, 0),
    recent,
    detail,
    detailDays: detail.since ? Math.max(1, Math.ceil((now - detail.since) / 86_400_000)) : 0,
  };
}

/** Today as YYYY-MM-DD, UTC. */
export function todayUtc(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}
