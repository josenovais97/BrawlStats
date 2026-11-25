/**
 * The Ranked stats page's numbers (2026-11-25): bans by rank and map, and what
 * each brawler does in a game. Client-safe: shapes and the pure arithmetic.
 * The reads are in lib/ranked-numbers-data.
 */

export const RANK_KEYS = ['mythic-plus', 'diamond', 'mythic', 'legendary', 'masters'] as const;
export type RankKey = (typeof RANK_KEYS)[number];

/** Which `rank_bracket`s each choice reads (lib/rank-brackets). */
export const RANK_BRACKET_IDS: Record<RankKey, number[]> = {
  'mythic-plus': [2, 3, 4],
  diamond: [1],
  mythic: [2],
  legendary: [3],
  masters: [4],
};

export function isRankKey(value: string | null | undefined): value is RankKey {
  return (RANK_KEYS as readonly string[]).includes(value ?? '');
}

/** The Ranked modes, in the order the page lists them. */
export const NUMBER_MODES = ['gemGrab', 'brawlBall', 'heist', 'bounty', 'hotZone', 'knockout'] as const;

/** Fewer games than this and a brawler is not ranked: its numbers are luck. */
export const MIN_GAMES = 150;
/** Fewer battles than this on a map and its bans are not listed. */
export const MIN_MAP_BATTLES = 60;

/** One brawler over one selection: sums, as read. */
export interface RawStats {
  id: number;
  games: number;
  kills: number;
  deaths: number;
  deathless: number;
  stars: number;
  damage: number;
  healing: number;
  seconds: number;
}

/** One brawler as sent to the page. */
export interface BrawlerNumbers {
  id: number;
  games: number;
  /** Kills a game, and deaths. */
  kills: number;
  deaths: number;
  kd: number;
  /** Damage and healing a second of the game. */
  damage: number;
  healing: number;
  /** Share of games named star player, and of games without dying. */
  star: number;
  deathless: number;
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

export function numbersOf(r: RawStats): BrawlerNumbers {
  return {
    id: r.id,
    games: r.games,
    kills: round(r.kills / r.games, 2),
    deaths: round(r.deaths / r.games, 2),
    // A brawler that never died has as many kills per death as kills.
    kd: round(r.kills / Math.max(1, r.deaths), 2),
    damage: round(r.damage / Math.max(1, r.seconds), 1),
    healing: round(r.healing / Math.max(1, r.seconds), 1),
    star: round(r.stars / r.games, 4),
    deathless: round(r.deathless / r.games, 4),
  };
}

/** Sums of several modes for one brawler, as one row. */
export function addStats(rows: RawStats[]): RawStats[] {
  const by = new Map<number, RawStats>();
  for (const r of rows) {
    const t = by.get(r.id);
    if (!t) by.set(r.id, { ...r });
    else {
      t.games += r.games;
      t.kills += r.kills;
      t.deaths += r.deaths;
      t.deathless += r.deathless;
      t.stars += r.stars;
      t.damage += r.damage;
      t.healing += r.healing;
      t.seconds += r.seconds;
    }
  }
  return [...by.values()];
}

/** A ban rate per brawler: [brawler id, share of games], most banned first. */
export type BanList = [number, number][];

export interface MapBans {
  mode: string;
  map: string;
  battles: number;
  bans: BanList;
}

export interface RankNumbers {
  rank: RankKey;
  /** Battles whose bans were recorded. */
  battles: number;
  bans: BanList;
  maps: MapBans[];
  /** 'all' and each mode. */
  stats: Record<string, BrawlerNumbers[]>;
}

/**
 * The ban tiers: the share of games a brawler is banned in. Fixed cuts, so the
 * same letter means the same thing at every rank and on every map.
 */
export const BAN_TIERS = [
  { tier: 'S', min: 0.4 },
  { tier: 'A', min: 0.2 },
  { tier: 'B', min: 0.1 },
  { tier: 'C', min: 0.05 },
] as const;

export function banTiers(bans: BanList): { tier: (typeof BAN_TIERS)[number]['tier']; min: number; items: BanList }[] {
  let top = Infinity;
  return BAN_TIERS.map(({ tier, min }) => {
    const items = bans.filter(([, rate]) => rate >= min && rate < top);
    top = min;
    return { tier, min, items };
  });
}

export const METRICS = ['kd', 'kills', 'deaths', 'damage', 'healing', 'star', 'deathless'] as const;
export type Metric = (typeof METRICS)[number];

/** Best first is the highest, but for deaths. */
export function bestFirst(metric: Metric): 'high' | 'low' {
  return metric === 'deaths' ? 'low' : 'high';
}

export function rankBy(rows: BrawlerNumbers[], metric: Metric, order: 'high' | 'low', minGames = MIN_GAMES): BrawlerNumbers[] {
  const sign = order === 'high' ? -1 : 1;
  return rows.filter((r) => r.games >= minGames).sort((a, b) => sign * (a[metric] - b[metric]) || b.games - a.games);
}
