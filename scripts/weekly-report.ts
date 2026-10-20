/**
 * The numbers behind the weekly Ranked report carousel (2026-10-20).
 *
 *   docker compose run --rm -T sampler node --import tsx --conditions=react-server scripts/weekly-report.ts
 *
 * Prints one JSON document on stdout: the season and which week of it this
 * is, every tiered brawler from the 7-day Ranked meta, the trial brawlers, and
 * the top three picks for each map in the live rotation.
 * deploy/bin/brawlzone-weekly keeps each week's output and draws the slides
 * from this one and the one before it, so "who climbed" is a comparison of
 * two saved files rather than a second query.
 */
import { getSeasonState } from '@/lib/ranked-seasons';
import { rotationMaps } from '@/lib/ranked-rotation';
import { slugify } from '@/lib/slugs';
import { getMetaIndex, getRankedMapPicks, getRankedRecentMaps } from '@/lib/stats';

async function main() {
  const season = await getSeasonState();
  const [picks, meta, recent] = await Promise.all([
    getRankedMapPicks(3),
    getMetaIndex('ranked', 7),
    getRankedRecentMaps(),
  ]);
  const live = rotationMaps({ recent, pool: season.mapPool });

  const tiered = [...meta.values()].filter((b) => b.tier);
  const all = tiered.map((b) => ({
    n: b.brawlerName,
    id: b.brawlerId,
    tier: b.tier,
    wr: b.normalizedWinRate,
    use: b.usageRate,
    score: b.metaScore,
  }));
  const bySlug = new Map(tiered.map((b) => [slugify(b.brawlerName), b]));
  const trial = (season.current?.trialBrawlers ?? []).flatMap((n) => {
    const b = bySlug.get(slugify(n));
    return b ? [{ n, id: b.brawlerId, tier: b.tier, wr: b.normalizedWinRate }] : [];
  });

  // Rotation names and pick names are spelled differently ("Belle's Rock"
  // against "belles-rock"), so both sides are compared without punctuation.
  const key = (mode: string, map: string) => `${slugify(mode).replace(/-/g, '')}/${slugify(map).replace(/-/g, '')}`;
  const byMap = new Map(picks.map((p) => [key(p.mode, p.mapName), p]));
  const pool = [...live.entries()].map(([mode, maps]) => ({
    mode,
    maps: maps.map((m) => {
      const p = byMap.get(key(mode, m));
      return {
        m,
        n: p?.sampleSize ?? 0,
        picks: (p?.picks ?? []).slice(0, 3).map((x) => ({ n: x.brawlerName, id: x.brawlerId })),
      };
    }),
  }));

  const startsOn = season.current?.startsOn ?? null;
  const week = startsOn ? Math.floor((Date.now() - Date.parse(`${startsOn}T00:00:00Z`)) / (7 * 86_400_000)) + 1 : null;
  console.log(JSON.stringify({ season: season.current?.number ?? null, startsOn, week, all, trial, pool }));
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
