import type { Metadata } from 'next';
import { Swords, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { brawlerIconUrl, getBrawlerMap } from '@/lib/brawlapi';
import { formatNumber, formatPercent, humanizeMode } from '@/lib/format';
import { getActiveMaps } from '@/lib/game-maps';
import { slugify } from '@/lib/slugs';
import {
  RANKED_MAP_WINDOW_DAYS,
  getBestPicksByMode,
  getCounterScores,
  getRankedMapPicks,
} from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';
import type { ModePick, RankedMapPick } from '@/types/stats';

export const metadata: Metadata = {
  title: 'Brawl Stars draft helper — pick against the enemy team',
  description:
    'Pick a Ranked map, name the brawlers the enemy has drafted, and see which brawlers have the best record on that map against that line-up.',
  alternates: { canonical: '/draft' },
};

export const revalidate = 3600;

/** How many enemy picks a Ranked draft can have. */
const MAX_ENEMIES = 3;

/** How many candidates to rank. */
const CANDIDATES = 12;

interface PageProps {
  searchParams: Promise<{ map?: string; mode?: string; enemy?: string }>;
}

export default async function DraftPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const maps = await getActiveMaps().catch(() => []);
  const selected = params.map
    ? maps.find(
        (entry) =>
          entry.mapSlug === slugify(params.map!) &&
          (!params.mode || entry.modeSlug === slugify(params.mode)),
      )
    : undefined;

  const enemies = (params.enemy ?? '')
    .split(',')
    .map((value) => Number(value))
    .filter((id) => Number.isFinite(id) && id > 0)
    .slice(0, MAX_ENEMIES);

  const brawlerMeta = await getBrawlerMap().catch(() => new Map<number, BABrawler>());

  // Sequential database reads keep the page to a single connection.
  const mapPicks =
    selected?.scHash
      ? await getRankedMapPicks(60, RANKED_MAP_WINDOW_DAYS, {
          mapName: selected.map.name,
          mode: selected.scHash,
        }).then((rows) => rows[0] ?? null)
      : null;

  const modePicks = selected?.scHash
    ? await getBestPicksByMode(60)
        .then((byMode) => byMode.get(selected.scHash!) ?? null)
        .catch(() => null)
    : null;

  const counters = await getCounterScores(enemies);

  // The map's own ranking is the starting order; the enemy line-up reorders it.
  // Both halves stay visible in the row, because a pick that is good here and a
  // pick that is good against them are different claims and a reader drafting
  // in ninety seconds needs to see which one is carrying the recommendation.
  const basePicks: (ModePick | RankedMapPick)[] =
    (mapPicks?.picks.length ?? 0) > 0 ? mapPicks!.picks : (modePicks?.picks ?? []);

  const ranked = basePicks
    .map((pick) => {
      const counter = counters.get(pick.brawlerId);
      return {
        pick,
        counter,
        // Half a point of counter edge is worth about as much as half a point
        // of map score, so they are simply added. Nothing subtler is defensible
        // on samples this size.
        total: pick.score + (counter?.edge ?? 0),
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, CANDIDATES);

  const hrefFor = (next: { map?: string; mode?: string; enemy?: number[] }) => {
    const query = new URLSearchParams();
    const map = next.map ?? selected?.mapSlug;
    const mode = next.mode ?? selected?.modeSlug;
    const enemyList = next.enemy ?? enemies;
    if (map) query.set('map', map);
    if (mode) query.set('mode', mode);
    if (enemyList.length > 0) query.set('enemy', enemyList.join(','));
    const string = query.toString();
    return string ? `/draft?${string}` : '/draft';
  };

  return (
    <div className="space-y-8">
      <JsonLd data={breadcrumbSchema([{ name: 'Draft helper', path: '/draft' }])} />

      <PageHeading
        title="Draft helper"
        subtitle="Pick the map, name what the enemy has taken, and the list reorders around both. Every state is its own URL, so a draft can be shared or kept open on a second screen."
        aside={
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <Swords className="size-4" />
            Ranked
          </span>
        }
      />

      <section>
        <SectionHeading
          title="1. The map"
          aside={selected ? <Link href="/draft" className="hover:text-foreground">Clear</Link> : null}
        />
        {selected ? (
          <div className="card flex items-center gap-4 p-4">
            {selected.map.imageUrl ? (
              <Image
                src={selected.map.imageUrl}
                alt=""
                width={96}
                height={64}
                sizes="96px"
                className="h-16 w-24 shrink-0 rounded-lg bg-surface-2 object-contain"
                unoptimized
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{selected.map.name}</p>
              <p className="text-sm text-muted">
                {selected.mode?.name ?? selected.map.gameMode.name}
                {mapPicks
                  ? ` · ${formatNumber(mapPicks.sampleSize)} sampled Ranked battles`
                  : ' · using mode-wide picks'}
              </p>
            </div>
            <Link
              href={`/maps/${selected.modeSlug}/${selected.mapSlug}`}
              className="shrink-0 text-sm font-medium text-muted hover:text-foreground"
            >
              Map page
            </Link>
          </div>
        ) : (
          <MapChooser maps={maps} />
        )}
      </section>

      {selected ? (
        <>
          <section>
            <SectionHeading
              title="2. The enemy team"
              subtitle={`Add up to ${MAX_ENEMIES} brawlers the other side has drafted. Each one reweighs the list by how candidates actually do against it.`}
            />

            {enemies.length > 0 ? (
              <ul className="mb-3 flex flex-wrap gap-2">
                {enemies.map((id) => {
                  const meta = brawlerMeta.get(id);
                  return (
                    <li key={id}>
                      <Link
                        href={hrefFor({ enemy: enemies.filter((other) => other !== id) })}
                        className="card card-interactive flex items-center gap-2 px-3 py-2 text-sm font-semibold capitalize"
                      >
                        <Image
                          src={meta?.imageUrl ?? brawlerIconUrl(id)}
                          alt=""
                          width={24}
                          height={24}
                          className="size-6 rounded"
                          unoptimized
                        />
                        {(meta?.name ?? `#${id}`).toLowerCase()}
                        <X className="size-3.5 text-muted" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {enemies.length < MAX_ENEMIES ? (
              <EnemyChooser
                brawlerMeta={brawlerMeta}
                enemies={enemies}
                hrefFor={hrefFor}
              />
            ) : (
              <p className="text-sm text-muted">
                Enemy team full. Remove one to swap it out.
              </p>
            )}
          </section>

          <section>
            <SectionHeading
              title="3. Your pick"
              subtitle={
                enemies.length > 0
                  ? 'Map score plus how each candidate does against the brawlers you named.'
                  : 'Ranked by record on this map. Add enemy picks above to reweigh it.'
              }
            />

            {ranked.length === 0 ? (
              <p className="card p-6 text-sm leading-relaxed text-muted">
                No sampled battles for this map or mode yet. The sampler works through
                the leaderboard pool continuously, so this fills in over the next day or
                two.
              </p>
            ) : (
              <ol className="card divide-y divide-border overflow-hidden">
                {ranked.map(({ pick, counter }, index) => {
                  const meta = brawlerMeta.get(pick.brawlerId);
                  return (
                    <li key={pick.brawlerId}>
                      <Link
                        href={`/brawlers/${pick.brawlerId}`}
                        className="row-interactive flex items-center gap-3 px-4 py-3"
                      >
                        <span className="w-5 shrink-0 text-center text-sm font-black tabular-nums text-muted">
                          {index + 1}
                        </span>
                        <Image
                          src={meta?.imageUrl ?? brawlerIconUrl(pick.brawlerId)}
                          alt=""
                          width={40}
                          height={40}
                          className="size-10 shrink-0 rounded-lg bg-surface-2"
                          loading="lazy"
                          unoptimized
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold capitalize">
                            {pick.brawlerName.toLowerCase()}
                          </span>
                          <span className="block text-xs tabular-nums text-muted">
                            {formatNumber(pick.decidedSampleSize)} battles here
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-bold tabular-nums text-victory">
                            {formatPercent(pick.score)}
                          </span>
                          {counter ? (
                            <span
                              className={`block text-[0.625rem] tabular-nums ${
                                counter.edge > 0 ? 'text-victory/80' : 'text-defeat/80'
                              }`}
                            >
                              {counter.edge > 0 ? '+' : '−'}
                              {Math.abs(counter.edge * 100).toFixed(1)} vs their picks
                            </span>
                          ) : enemies.length > 0 ? (
                            <span className="block text-[0.625rem] text-muted">
                              no matchup data
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}

            <p className="mt-3 text-xs leading-relaxed text-muted">
              Map score is a brawler&rsquo;s adjusted win rate here, weighed against its
              overall Ranked form. The matchup figure is its win rate when one of the
              brawlers you named was on the other team, minus its own average — so a
              brawler that simply wins a lot does not appear to counter everything.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

/** Map picker: every active map, grouped by mode, as plain links. */
function MapChooser({ maps }: { maps: Awaited<ReturnType<typeof getActiveMaps>> }) {
  const byMode = new Map<string, typeof maps>();
  for (const entry of maps) {
    const list = byMode.get(entry.modeSlug) ?? [];
    list.push(entry);
    byMode.set(entry.modeSlug, list);
  }

  if (maps.length === 0) {
    return (
      <p className="card p-6 text-sm text-muted">
        The map catalogue is unavailable right now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {[...byMode].map(([mode, list]) => (
        <div key={mode}>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
            {list[0].mode?.name ?? humanizeMode(mode)}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {list.map((entry) => (
              <li key={entry.map.id}>
                <Link
                  href={`/draft?map=${entry.mapSlug}&mode=${entry.modeSlug}`}
                  className="card card-interactive block px-3 py-2 text-sm font-medium"
                >
                  {entry.map.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Enemy picker: the full roster as links that append to the query string. */
function EnemyChooser({
  brawlerMeta,
  enemies,
  hrefFor,
}: {
  brawlerMeta: Map<number, BABrawler>;
  enemies: number[];
  hrefFor: (next: { enemy?: number[] }) => string;
}) {
  const options = [...brawlerMeta.values()]
    .filter((brawler) => !enemies.includes(brawler.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ul className="flex flex-wrap gap-1.5">
      {options.map((brawler) => (
        <li key={brawler.id}>
          <Link
            href={hrefFor({ enemy: [...enemies, brawler.id] })}
            title={`Add ${brawler.name} to the enemy team`}
            className="block rounded-lg bg-surface-2 p-1 transition-transform hover:-translate-y-0.5"
          >
            <Image
              src={brawler.imageUrl}
              alt={brawler.name}
              width={40}
              height={40}
              className="size-10"
              loading="lazy"
              unoptimized
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
