import { normalizeTag } from '@/lib/tags';
import type { BSBattleLogEntry, BSBattlePlayer } from '@/types/brawlstars';

/**
 * The bans and combat stats a Ranked battle carries since November 2026, packed
 * for `battle_team_samples` (2026-11-25). Pure, so it can be tested.
 *
 * Brawler ids are stored less `BRAWLER_ID_BASE`, which fits them in a smallint:
 * 175,000 of these rows are written a day.
 */
export const BRAWLER_ID_BASE = 16_000_000;
/** Integers before the first player in `lineupStats`: seconds, star player. */
export const STATS_HEAD = 2;
/** Integers per player: brawler, kills, deaths, damage, healing. */
export const STATS_PER_PLAYER = 5;

export interface RankedExtras {
  /** One per player who banned somebody; both teams may name the same brawler. */
  banIds: number[];
  /**
   * `[seconds, star (0-5 or -1), then five numbers a player]`: the sampled
   * player's team first, then the other. Empty when anything is missing.
   */
  lineupStats: number[];
}

const NONE: RankedExtras = { banIds: [], lineupStats: [] };

/** A whole number a 4-byte integer holds, or null. */
function int(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 2_000_000_000 ? Math.round(value) : null;
}

/** A brawler id as stored: less the base, or null for anything that is not one. */
function packed(id: unknown): number | null {
  return typeof id === 'number' && id > BRAWLER_ID_BASE && id - BRAWLER_ID_BASE < 32_767 ? id - BRAWLER_ID_BASE : null;
}

/** What to keep of a battle's bans and stats, seen from `playerTag`'s side. */
export function rankedExtras(entry: BSBattleLogEntry, playerTag: string): RankedExtras {
  const teams = entry.battle.teams;
  if (!teams || teams.length !== 2 || teams.some((t) => t.length !== 3)) return NONE;
  const own = teams.findIndex((t) => t.some((p) => normalizeTag(p.tag) === playerTag));
  if (own === -1) return NONE;
  const players: BSBattlePlayer[] = [...teams[own], ...teams[own === 0 ? 1 : 0]];

  const banIds = players.map((p) => packed(p.bannedBrawler?.id)).filter((id): id is number => id !== null);

  const seconds = int(entry.battle.duration);
  const starTag = entry.battle.starPlayer?.tag ? normalizeTag(entry.battle.starPlayer.tag) : null;
  const lineupStats: number[] = [seconds ?? 0, starTag ? players.findIndex((p) => normalizeTag(p.tag) === starTag) : -1];
  for (const p of players) {
    const row = [packed(p.brawler?.id), int(p.stats?.kills), int(p.stats?.deaths), int(p.stats?.damageDealt), int(p.stats?.healing)];
    if (row.some((n) => n === null)) return { banIds, lineupStats: [] };
    lineupStats.push(...(row as number[]));
  }
  // A game with no length cannot be put per minute.
  return { banIds, lineupStats: seconds ? lineupStats : [] };
}
