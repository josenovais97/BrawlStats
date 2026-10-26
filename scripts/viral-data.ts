/**
 * The numbers behind the daily viral Short (2026-10-22).
 *
 *   docker compose run --rm -T sampler node --import tsx --conditions=react-server scripts/viral-data.ts
 *
 * Prints one JSON document on stdout for deploy/viral/make.py: the 7-day
 * Ranked meta (`all`), the last 3 days of it (`recent`, which
 * deploy/bin/brawlzone-viral keeps one of per day so "who got broken" compares
 * two windows a week apart that do not overlap), the top picks per live map
 * (`pool`) and the most-picked brawlers per rank bracket (`brackets`).
 */
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { getSeasonState } from '@/lib/ranked-seasons';
import { rotationMaps } from '@/lib/ranked-rotation';
import { slugify } from '@/lib/slugs';
import { getBracketRoster, getRankedMapPicks, getRankedRecentMaps, getScoredRoster } from '@/lib/stats';

const BRACKETS = [
  ['low', 1],
  ['mythic', 2],
  ['legendary', 3],
  ['pro', 4],
] as const;

async function main() {
  const season = await getSeasonState();
  const [picks, week, recent, maps, catalog] = await Promise.all([
    getRankedMapPicks(3),
    getScoredRoster(7, undefined, 'ranked'),
    getScoredRoster(3, undefined, 'ranked'),
    getRankedRecentMaps(),
    // Class and rarity, for the "every assassin ranked" series. Optional: a
    // missing catalogue only takes that format off the table for the day.
    getBrawlerCatalog().catch(() => null),
  ]);
  const facts = new Map((catalog?.all ?? []).map((b) => [b.id, b]));
  const live = rotationMaps({ recent: maps, pool: season.mapPool });

  const row = (b: (typeof week)[number]) => ({
    n: b.brawlerName,
    id: b.brawlerId,
    tier: b.tier,
    wr: b.normalizedWinRate,
    use: b.usageRate,
    score: b.metaScore,
    battles: b.decidedSampleSize,
    cls: facts.get(b.brawlerId)?.className ?? null,
    rar: facts.get(b.brawlerId)?.rarityName ?? null,
  });

  const key = (mode: string, map: string) => `${slugify(mode).replace(/-/g, '')}/${slugify(map).replace(/-/g, '')}`;
  const byMap = new Map(picks.map((p) => [key(p.mode, p.mapName), p]));
  const pool = [...live.entries()].map(([mode, list]) => ({
    mode,
    maps: list.map((m) => {
      const p = byMap.get(key(mode, m));
      return {
        m,
        n: p?.sampleSize ?? 0,
        picks: (p?.picks ?? []).slice(0, 3).map((x) => ({ n: x.brawlerName, id: x.brawlerId })),
      };
    }),
  }));

  const brackets: Record<string, unknown> = {};
  for (const [name, id] of BRACKETS) {
    const r = await getBracketRoster(id);
    const s = (r?.scored ?? [])
      .filter((b) => b.usageRate !== null)
      .sort((a, b) => (b.usageRate ?? 0) - (a.usageRate ?? 0));
    brackets[name] = {
      battles: s.reduce((n, b) => n + b.decidedSampleSize, 0),
      top: s.slice(0, 8).map(row),
    };
  }

  console.log(
    JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      season: season.current?.number ?? null,
      all: week.filter((b) => b.tier).map(row),
      recent: recent.filter((b) => b.tier).map(row),
      pool,
      brackets,
    }),
  );
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
