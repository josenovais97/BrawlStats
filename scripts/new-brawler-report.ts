/**
 * The numbers behind a new brawler's "first stats" post (2026-10-21).
 *
 *   docker compose run --rm -T sampler node --import tsx --conditions=react-server scripts/new-brawler-report.ts <brawler id>
 *
 * Prints one JSON document on stdout for deploy/bin/brawlzone-newbrawler.
 * A brand-new brawler is kept out of competitive Ranked for its first weeks,
 * so the verdict comes from trophy matches: the site's own trophy scoring
 * (tier, adjusted win rate, rank among every tiered brawler), the maps where
 * it beats that map's average by the most, and the star power, gadget and
 * gears most of its owners run.
 *
 * Trophy matches here are `battle_type = 'ranked'` -- the API's name for the
 * ladder; competitive Ranked is `soloRanked`. Only victories and defeats
 * count on maps: a Showdown placement is neither, and counting it as a loss
 * once made the strongest brawler of the week read as the weakest.
 */
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getPrisma } from '@/lib/prisma';
import { getMetaIndex } from '@/lib/stats';

async function main() {
  const id = Number(process.argv[2]);
  if (!Number.isInteger(id)) throw new Error('usage: new-brawler-report.ts <brawler id>');
  const prisma = getPrisma();
  if (!prisma) throw new Error('no database');

  const [trophy, ranked, art] = await Promise.all([
    getMetaIndex('trophy', 7),
    getMetaIndex('ranked', 7),
    getBrawlerArtMap(),
  ]);
  const tiered = [...trophy.values()]
    .filter((b) => b.tier !== null)
    .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0));
  const me = trophy.get(id);
  const brawler = art.get(id);

  // Each map's own average is the bar, over the same three days.
  const maps = await prisma.$queryRaw<{ map: string; mode: string; n: bigint; wr: number; base: number }[]>`
    with b as (
      select map_name, mode, brawler_id, (result = 'victory')::int as w
        from battle_samples
       where battle_type = 'ranked' and result in ('victory', 'defeat')
         and map_name is not null and battle_time >= now() - interval '3 days'
    ),
    m as (select map_name, mode, avg(w) as base from b group by 1, 2),
    v as (
      select map_name, mode, count(*) as n, avg(w) as wr from b
       where brawler_id = ${id} group by 1, 2 having count(*) >= 500
    )
    select v.map_name as map, v.mode, v.n, v.wr::float8 as wr, m.base::float8 as base
      from v join m using (map_name, mode)
     order by v.wr - m.base desc
     limit 5`;

  const build = await prisma.$queryRaw<{ kind: string; item: number; owners: number; total: number }[]>`
    select kind, item_id as item, owners, total_owners as total
      from brawler_build_stats
     where brawler_id = ${id}
       and snapshot_date = (select max(snapshot_date) from brawler_build_stats where brawler_id = ${id})
     order by kind, owners desc`;

  const names = new Map<number, string>();
  for (const a of [...(brawler?.starPowers ?? []), ...(brawler?.gadgets ?? [])]) names.set(a.id, a.name);
  const top = (kind: string, count: number) =>
    build
      .filter((r) => r.kind === kind)
      .slice(0, count)
      .map((r) => ({ id: r.item, name: names.get(r.item) ?? null, share: r.total ? r.owners / r.total : 0 }));

  console.log(
    JSON.stringify({
      id,
      name: brawler?.name ?? me?.brawlerName ?? null,
      avatarId: brawler?.avatarId ?? null,
      rarity: brawler?.rarity?.name ?? null,
      class: brawler?.class?.name ?? null,
      tier: me?.tier ?? null,
      rank: me ? tiered.findIndex((b) => b.brawlerId === id) + 1 : null,
      of: tiered.length,
      winRate: me?.winRate ?? null,
      baseline: me?.baselineWinRate ?? null,
      adjusted: me?.normalizedWinRate ?? null,
      battles: me?.decidedSampleSize ?? 0,
      inRanked: ranked.has(id),
      maps: maps.map((m) => ({ map: m.map, mode: m.mode, n: Number(m.n), wr: m.wr, base: m.base })),
      build: { starPower: top('starPower', 1), gadget: top('gadget', 1), gears: top('gear', 2) },
    }),
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
