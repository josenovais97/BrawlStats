/**
 * Kills, deaths and damage of a player's Ranked games (2026-11-25). Pure: the
 * stored games come from lib/stats, the live ones from the battle log.
 */
import { BRAWLER_ID_BASE, STATS_HEAD, STATS_PER_PLAYER } from '@/lib/ranked-extras';
import type { BrawlerNumbers } from '@/lib/ranked-numbers';
import type { BSBattleLogEntry } from '@/types/brawlstars';

/** One player's numbers in one game. */
export interface GameCombat {
  kills: number;
  deaths: number;
  damage: number;
  healing: number;
  /** The game's length. */
  seconds: number;
  /** Named star player. */
  star: boolean;
}

/** Sums over games. */
export interface CombatTotals {
  games: number;
  kills: number;
  deaths: number;
  deathless: number;
  stars: number;
  damage: number;
  healing: number;
  seconds: number;
}

export const NO_COMBAT: CombatTotals = { games: 0, kills: 0, deaths: 0, deathless: 0, stars: 0, damage: 0, healing: 0, seconds: 0 };

/** Fewer games than this and a player's numbers are not shown. */
export const MIN_COMBAT_GAMES = 5;

/** The sampled player's line of a stored battle: their team is first. */
export function combatFromStored(brawlerId: number, lineupStats: number[] | null | undefined): GameCombat | null {
  if (!lineupStats || lineupStats.length !== STATS_HEAD + 6 * STATS_PER_PLAYER) return null;
  for (let i = 0; i < 3; i++) {
    const at = STATS_HEAD + i * STATS_PER_PLAYER;
    if (lineupStats[at] !== brawlerId - BRAWLER_ID_BASE) continue;
    return {
      kills: lineupStats[at + 1],
      deaths: lineupStats[at + 2],
      damage: lineupStats[at + 3],
      healing: lineupStats[at + 4],
      seconds: lineupStats[0],
      star: lineupStats[1] === i,
    };
  }
  return null;
}

const sameTag = (a: string | undefined, b: string) => (a ?? '').replace(/^#/, '').toUpperCase() === b.replace(/^#/, '').toUpperCase();

/** The player's line of a battle in the live log, or null when it carries none. */
export function combatFromLog(entry: BSBattleLogEntry, playerTag: string): GameCombat | null {
  const battle = entry.battle;
  const me = battle?.teams?.flat().find((p) => sameTag(p.tag, playerTag));
  if (!me?.stats || !battle.duration) return null;
  const { kills, deaths, damageDealt, healing } = me.stats;
  if (![kills, deaths, damageDealt, healing].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  return { kills, deaths, damage: damageDealt, healing, seconds: battle.duration, star: sameTag(battle.starPlayer?.tag, playerTag) };
}

export function addGame(t: CombatTotals, g: GameCombat): CombatTotals {
  return {
    games: t.games + 1,
    kills: t.kills + g.kills,
    deaths: t.deaths + g.deaths,
    deathless: t.deathless + (g.deaths === 0 ? 1 : 0),
    stars: t.stars + (g.star ? 1 : 0),
    damage: t.damage + g.damage,
    healing: t.healing + g.healing,
    seconds: t.seconds + g.seconds,
  };
}

export function addTotals(a: CombatTotals, b: CombatTotals): CombatTotals {
  return {
    games: a.games + b.games,
    kills: a.kills + b.kills,
    deaths: a.deaths + b.deaths,
    deathless: a.deathless + b.deathless,
    stars: a.stars + b.stars,
    damage: a.damage + b.damage,
    healing: a.healing + b.healing,
    seconds: a.seconds + b.seconds,
  };
}

/** What the totals come to. */
export interface CombatRates {
  kd: number;
  kills: number;
  deaths: number;
  /** A second of the game. */
  damage: number;
  healing: number;
  star: number;
  deathless: number;
}

export function combatRates(t: CombatTotals): CombatRates | null {
  if (t.games === 0) return null;
  return {
    kd: t.kills / Math.max(1, t.deaths),
    kills: t.kills / t.games,
    deaths: t.deaths / t.games,
    damage: t.damage / Math.max(1, t.seconds),
    healing: t.healing / Math.max(1, t.seconds),
    star: t.stars / t.games,
    deathless: t.deathless / t.games,
  };
}

/** A stored day of one brawler (player_ranked_combat_daily). */
export interface CombatDay extends CombatTotals {
  day: string;
  brawlerId: number;
}

export interface PlayerCombat {
  totals: CombatTotals;
  byBrawler: Map<number, CombatTotals>;
}

/**
 * A season's combat: the single games where we have them, and the stored days
 * before the oldest of those. A day is never counted from both.
 */
export function playerCombat(games: { time: number; brawlerId: number; combat?: GameCombat | null }[], days: CombatDay[]): PlayerCombat {
  const single = games.filter((g) => g.combat);
  const oldest = single.length ? new Date(Math.min(...single.map((g) => g.time))).toISOString().slice(0, 10) : null;
  const byBrawler = new Map<number, CombatTotals>();
  const put = (id: number, t: CombatTotals) => byBrawler.set(id, addTotals(byBrawler.get(id) ?? NO_COMBAT, t));
  for (const d of days) if (oldest === null || d.day < oldest) put(d.brawlerId, d);
  for (const g of single) put(g.brawlerId, addGame(NO_COMBAT, g.combat!));
  let totals = NO_COMBAT;
  for (const t of byBrawler.values()) totals = addTotals(totals, t);
  return { totals, byBrawler };
}

/**
 * What an average player at the rank would have with the same brawlers the
 * same number of games: "others" beside a player's own numbers, so a Mortis
 * main is not told off for dying more than a Piper. Null unless at least
 * `cover` of the games are on brawlers the rank has numbers for.
 */
export function expectedRates(byBrawler: Map<number, CombatTotals>, rank: BrawlerNumbers[], cover = 0.7): CombatRates | null {
  const of = new Map(rank.map((r) => [r.id, r]));
  let games = 0;
  let known = 0;
  const sum = { kills: 0, deaths: 0, damage: 0, healing: 0, star: 0, deathless: 0 };
  for (const [id, t] of byBrawler) {
    games += t.games;
    const r = of.get(id);
    if (!r) continue;
    known += t.games;
    sum.kills += r.kills * t.games;
    sum.deaths += r.deaths * t.games;
    sum.damage += r.damage * t.games;
    sum.healing += r.healing * t.games;
    sum.star += r.star * t.games;
    sum.deathless += r.deathless * t.games;
  }
  if (games === 0 || known / games < cover) return null;
  return {
    kd: sum.kills / Math.max(0.01, sum.deaths),
    kills: sum.kills / known,
    deaths: sum.deaths / known,
    damage: sum.damage / known,
    healing: sum.healing / known,
    star: sum.star / known,
    deathless: sum.deathless / known,
  };
}
