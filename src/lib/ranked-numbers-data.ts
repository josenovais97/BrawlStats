import 'server-only';

import { unstable_cache } from 'next/cache';
import { cache } from 'react';

import { getPrisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import {
  MIN_GAMES, MIN_MAP_BATTLES, NUMBER_MODES, RANK_BRACKET_IDS, addStats, numbersOf,
  type BanList, type RankKey, type RankNumbers, type RawStats,
} from '@/lib/ranked-numbers';
import { windowStartUtc } from '@/lib/stats';

/** A week, like the tier lists beside it. */
const WINDOW_DAYS = 7;
/** How many brawlers a map's list carries. */
const MAP_LIST = 24;

const rate = (n: number, of: number) => Math.round((n / of) * 10_000) / 10_000;
const byRate = (a: [number, number], b: [number, number]) => b[1] - a[1];

/** One rank's bans and stats from the daily roll-ups (lib/aggregation rollUpRankedExtras). */
export async function computeRankNumbers(rank: RankKey): Promise<RankNumbers> {
  const empty: RankNumbers = { rank, battles: 0, bans: [], maps: [], stats: {} };
  const prisma = getPrisma();
  if (!prisma) return empty;
  const since = windowStartUtc(WINDOW_DAYS);
  const brackets = Prisma.join(RANK_BRACKET_IDS[rank]);

  const [banRows, statRows] = await Promise.all([
    prisma.$queryRaw<{ mode: string; map_name: string; brawler_id: number; n: number }[]>`
      SELECT mode, map_name, brawler_id, SUM(battles)::int AS n
      FROM ranked_ban_daily WHERE day >= ${since} AND rank_bracket IN (${brackets})
      GROUP BY 1, 2, 3`,
    prisma.$queryRaw<(RawStats & { mode: string })[]>`
      SELECT mode, brawler_id AS id, SUM(games)::int AS games, SUM(kills)::int AS kills, SUM(deaths)::int AS deaths,
             SUM(deathless)::int AS deathless, SUM(stars)::int AS stars, SUM(damage)::float8 AS damage,
             SUM(healing)::float8 AS healing, SUM(seconds)::float8 AS seconds
      FROM ranked_stat_daily WHERE day >= ${since} AND rank_bracket IN (${brackets})
      GROUP BY 1, 2`,
  ]);

  // Brawler 0 is the number of battles: the denominator.
  let battles = 0;
  const total = new Map<number, number>();
  const maps = new Map<string, { mode: string; map: string; battles: number; bans: BanList }>();
  for (const r of banRows) {
    const key = `${r.mode}|${r.map_name}`;
    const m = maps.get(key) ?? { mode: r.mode, map: r.map_name, battles: 0, bans: [] };
    maps.set(key, m);
    if (r.brawler_id === 0) {
      m.battles += r.n;
      battles += r.n;
    } else {
      m.bans.push([r.brawler_id, r.n]);
      total.set(r.brawler_id, (total.get(r.brawler_id) ?? 0) + r.n);
    }
  }
  if (battles === 0) return empty;

  const modes = new Set<string>(NUMBER_MODES);
  const stats: RankNumbers['stats'] = {};
  const inModes = statRows.filter((r) => modes.has(r.mode));
  const keep = (rows: RawStats[]) => rows.filter((r) => r.games >= MIN_GAMES).map(numbersOf);
  stats.all = keep(addStats(inModes));
  for (const mode of NUMBER_MODES) stats[mode] = keep(inModes.filter((r) => r.mode === mode));

  return {
    rank,
    battles,
    bans: [...total].map(([id, n]): [number, number] => [id, rate(n, battles)]).filter(([, r]) => r >= 0.005).sort(byRate),
    maps: [...maps.values()]
      .filter((m) => modes.has(m.mode) && m.map && m.battles >= MIN_MAP_BATTLES)
      .map((m) => ({ ...m, bans: m.bans.map(([id, n]): [number, number] => [id, rate(n, m.battles)]).sort(byRate).slice(0, MAP_LIST) }))
      .sort((a, b) => NUMBER_MODES.indexOf(a.mode as never) - NUMBER_MODES.indexOf(b.mode as never) || a.map.localeCompare(b.map)),
    stats,
  };
}

const cached = unstable_cache(async (rank: RankKey) => computeRankNumbers(rank), ['rank-numbers'], { revalidate: 7200 });

/** `computeRankNumbers`, cached for pages: two hours, the sampler's own rhythm. */
export const getRankNumbers = cache(async (rank: RankKey): Promise<RankNumbers> => cached(rank));
