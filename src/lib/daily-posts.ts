import { getGameModeMap, getMapMap } from '@/lib/brawlapi';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { getActiveMaps } from '@/lib/game-maps';
import { dayNumber, mapOfDay, rotation } from '@/lib/map-of-day';
import { slugify } from '@/lib/slugs';
import {
  RANKED_MAP_WINDOW_DAYS,
  getLineupStats,
  getRankedComps,
  getRankedCounterScores,
  getRankedMapPicks,
} from '@/lib/stats';

/**
 * The two daily TikTok posts that replaced "findings" and "hidden meta" on
 * 2026-10-13. Those two mostly restated the same roster-wide picture day after
 * day; these each answer one draft question, about a different subject every
 * day:
 *
 * - Counter of the day: one popular Ranked brawler, and who beats it.
 * - Trio of the day: one Ranked map's best team of three.
 *
 * Like `mapOfDay`, each is derived from the date and the current data alone,
 * so the manifest and every slide image -- separate requests -- land on the
 * same subject without sharing state.
 */

/* --------------------------------------------------------------- counter */

/** Brawlers in the counter rotation: the most picked in Ranked. */
const COUNTER_POOL = 30;
/** Co-prime with the pool, so a month goes by before a brawler repeats. */
const COUNTER_STRIDE = 7;
/** Ranked games against the target before a counter is listed. */
const MIN_COUNTER_GAMES = 150;
/** Edges smaller than this are noise, not a counter. */
const MIN_EDGE = 0.01;

export interface CounterEntry {
  brawlerId: number;
  name: string;
  /** Win rate against the target, Ranked. */
  winRate: number;
  /** Beyond what the brawler and the target would each lead you to expect. */
  edge: number;
  games: number;
}

export interface CounterPost {
  date: string;
  target: { brawlerId: number; name: string; imageUrl: string | null };
  /** Share of Ranked picks, last 7 days. */
  pickRate: number;
  winRate: number | null;
  counters: CounterEntry[];
  avoid: CounterEntry[];
  windowDays: number;
}

export async function counterOfDay(date: string): Promise<CounterPost | null> {
  const [rows, catalog] = await Promise.all([
    getLineupStats(7).catch(() => []),
    getBrawlerCatalog().catch(() => null),
  ]);
  const pool = rows
    .filter((r) => r.usageRate !== null)
    .sort((a, b) => (b.usageRate ?? 0) - (a.usageRate ?? 0))
    .slice(0, COUNTER_POOL);
  if (pool.length === 0) return null;
  const name = (id: number, fallback: string) => catalog?.byId.get(id)?.name ?? fallback;

  // Walk forward from today's slot until a brawler has enough counters.
  const start = (((dayNumber(date) * COUNTER_STRIDE) % pool.length) + pool.length) % pool.length;
  for (let step = 0; step < pool.length; step += 1) {
    const target = pool[(start + step) % pool.length];
    const scores = await getRankedCounterScores([target.brawlerId], 21).catch(() => new Map());
    const all: CounterEntry[] = [...scores.values()]
      .filter((s) => s.brawlerId !== target.brawlerId && s.decidedSampleSize >= MIN_COUNTER_GAMES)
      .map((s) => ({
        brawlerId: s.brawlerId,
        name: name(s.brawlerId, `#${s.brawlerId}`),
        winRate: s.winRate,
        edge: s.edge,
        games: s.decidedSampleSize,
      }));
    // A counter also has to win: Squeak at 49% against Rico is better than
    // Squeak usually does, but "pick this" next to a losing record reads as a
    // mistake. Likewise an avoid has to actually lose.
    const counters = all
      .filter((e) => e.edge >= MIN_EDGE && e.winRate >= 0.5)
      .sort((a, b) => b.edge - a.edge)
      .slice(0, 5);
    const avoid = all
      .filter((e) => e.edge <= -MIN_EDGE && e.winRate < 0.5)
      .sort((a, b) => a.edge - b.edge)
      .slice(0, 3);
    if (counters.length < 5) continue;
    return {
      date,
      target: {
        brawlerId: target.brawlerId,
        name: name(target.brawlerId, target.brawlerName),
        imageUrl: catalog?.byId.get(target.brawlerId)?.imageUrl ?? null,
      },
      pickRate: target.usageRate ?? 0,
      winRate: target.winRate,
      counters,
      avoid,
      windowDays: 21,
    };
  }
  return null;
}

/* ------------------------------------------------------------------ trio */

/**
 * Games a trio needs to be posted. The panel lists thinner trios with their
 * count beside them; a post titled "best team" cannot carry a 20-game caveat.
 * Measured 2026-10-13: 19 of 26 Ranked maps have three trios over 40.
 */
const MIN_TRIO_GAMES = 40;

export interface TrioPost {
  date: string;
  mode: string;
  modeName: string;
  modeColor: string;
  modeIconUrl: string | null;
  mapName: string;
  mapArtUrl: string | null;
  trios: { brawlers: { id: number; name: string }[]; winRate: number; battles: number }[];
}

/**
 * A Ranked map with at least three trios of its own, from the same rotation as
 * the map of the day but half a cycle apart, so the two posts never land on
 * the same map on the same day.
 */
export async function trioOfDay(date: string): Promise<TrioPost | null> {
  const [rows, comps, modes, mapsById, catalogue, catalog, mapToday] = await Promise.all([
    getRankedMapPicks(10, RANKED_MAP_WINDOW_DAYS).catch(() => []),
    // Deeper than the panel's eight, so the floor below still leaves three.
    getRankedComps(30).catch(() => ({ maps: [], modes: [] })),
    getGameModeMap().catch(() => new Map()),
    getMapMap().catch(() => new Map()),
    getActiveMaps().catch(() => []),
    getBrawlerCatalog().catch(() => null),
    mapOfDay(date).catch(() => null),
  ]);
  const withTrios = new Map(
    comps.maps
      .map((m) => ({ ...m, comps: m.comps.filter((c) => c.battles >= MIN_TRIO_GAMES) }))
      .filter((m) => m.comps.length >= 3)
      .map((m) => [`${m.mode}|${m.mapName}`, m]),
  );
  const order = rotation(rows.filter((r) => withTrios.has(`${r.mode}|${r.mapName}`)));
  if (order.length === 0) return null;

  let index = (dayNumber(date) + Math.floor(order.length / 2)) % order.length;
  if (order.length > 1 && order[index].mapName === mapToday?.mapName) index = (index + 1) % order.length;
  const row = order[index];
  const list = withTrios.get(`${row.mode}|${row.mapName}`)!;

  const mode = modes.get(row.mode.toLowerCase());
  const listed = catalogue.find((m) => m.scHash === row.mode && m.mapSlug === slugify(row.mapName));
  const art = (row.eventId ? mapsById.get(row.eventId) : undefined) ?? listed?.map;
  const name = (id: number) => catalog?.byId.get(id)?.name ?? `#${id}`;

  return {
    date,
    mode: row.mode,
    modeName: mode?.name ?? row.mode,
    modeColor: mode?.color ?? '#35d0ff',
    modeIconUrl: mode?.imageUrl ?? null,
    mapName: row.mapName,
    mapArtUrl: art?.imageUrl ?? null,
    // The adjusted rate, which is what the list is ordered by.
    trios: list.comps.slice(0, 3).map((c) => ({
      brawlers: c.brawlerIds.map((id) => ({ id, name: name(id) })),
      winRate: c.normalizedWinRate ?? c.winRate,
      battles: c.battles,
    })),
  };
}
