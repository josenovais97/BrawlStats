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
import { getLatestReleaseNotes, updateHeadliners } from '@/lib/release-notes';
import { getSeasonState } from '@/lib/ranked-seasons';
import { rotationMaps } from '@/lib/ranked-rotation';
import { slugify } from '@/lib/slugs';
import { getStarrDrops } from '@/lib/starr-drops';
import { getBracketRoster, getRankedMapPicks, getRankedRecentMaps, getScoredRoster } from '@/lib/stats';

const BRACKETS = [
  ['low', 1],
  ['mythic', 2],
  ['legendary', 3],
  ['pro', 4],
] as const;

async function main() {
  const season = await getSeasonState();
  const [picks, week, recent, maps, catalog, trophyWeek, notes] = await Promise.all([
    getRankedMapPicks(3),
    getScoredRoster(7, undefined, 'ranked'),
    getScoredRoster(3, undefined, 'ranked'),
    getRankedRecentMaps(),
    // Class and rarity, for the "every assassin ranked" series. Optional: a
    // missing catalogue only takes that format off the table for the day.
    getBrawlerCatalog().catch(() => null),
    // For "what's new": a launch-week brawler is in trophy games first.
    getScoredRoster(7, undefined, 'trophy').catch(() => []),
    // The latest update's own new brawlers and Buffies, for "what's new".
    getLatestReleaseNotes().catch(() => null),
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

  // The drop tables for the "1,000 Chaos Drops" Short (2026-10-29), from the
  // same wiki read as /starr-drops. A failed read leaves them out and make.py
  // draws something else.
  const starrDrops = await getStarrDrops().catch(() => null);
  // Since 2026-11-02 every drop or box the Short can simulate honestly: one
  // with rarity odds and a table per rarity, or a box with one complete table
  // (one roll per box), plus its art for brawlzone-viral to cache.
  const simulatable = (type: NonNullable<typeof starrDrops>['types'][number]) =>
    type.rarityOdds.length > 0
      ? type.tables.length > 0 && type.tables.every((t) => t.rarity && t.rewards.length > 0)
      : type.tables.length === 1 && type.tables[0].listed > 0.95 && type.tables[0].listed < 1.06;
  const drops = Object.fromEntries(
    (starrDrops?.types ?? [])
      .filter(simulatable)
      .map((type) => [
        type.slug,
        {
          name: type.name,
          group: type.group,
          image: type.imageUrl,
          odds: type.rarityOdds,
          tables: type.tables.map((table) => ({
            rarity: table.rarity,
            rewards: table.rewards.map((r) => ({ reward: r.reward, amount: r.amount, label: r.label, icon: r.icon, chance: r.chance })),
          })),
        },
      ]),
  );

  // Written with a callback and awaited, not console.log: stdout is a pipe
  // here, Node writes to pipes asynchronously, and main's caller exits the
  // process at once -- which cut the file at 65,536 bytes the day it first
  // grew past that (2026-11-03), and every video of the day failed to parse.
  const out = JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      season: season.current?.number ?? null,
      all: week.filter((b) => b.tier).map(row),
      recent: recent.filter((b) => b.tier).map(row),
      update: notes ? headliners(notes, catalog?.all ?? []) : null,
      // The newest brawlers in the game, Ranked tier or not (2026-11-03): the
      // "what's new" video read them from `all`, which only holds brawlers
      // with a Ranked tier, so it skipped a launch week's brawlers entirely.
      newest: [...(catalog?.current ?? [])]
        .sort((a, b) => b.id - a.id)
        .slice(0, 8)
        .map((c) => {
          const ranked = week.find((b) => b.brawlerId === c.id && b.tier);
          return {
            ...(ranked ? row(ranked) : { n: c.name, id: c.id, tier: null, cls: c.className, rar: c.rarityName }),
            trophyTier: trophyWeek.find((b) => b.brawlerId === c.id)?.tier ?? null,
          };
        }),
      pool,
      brackets,
      drops,
    });
  await new Promise<void>((resolve, reject) => process.stdout.write(out + '\n', (e) => (e ? reject(e) : resolve())));
}

/** The update's headliners as catalogue ids; a new brawler the catalogue lacks is dropped. */
function headliners(
  notes: NonNullable<Awaited<ReturnType<typeof getLatestReleaseNotes>>>,
  all: { id: number; name: string }[],
) {
  const h = updateHeadliners(notes, all.map((b) => b.name));
  const ids = (names: string[]) =>
    names.flatMap((name) => {
      const b = all.find((c) => slugify(c.name) === slugify(name));
      return b ? [{ id: b.id, n: b.name }] : [];
    });
  return {
    title: notes.title,
    date: notes.publishedAt?.slice(0, 10) ?? null,
    brawlers: ids(h.brawlers),
    buffies: ids(h.buffies),
    hypercharges: ids(h.hypercharges),
  };
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
