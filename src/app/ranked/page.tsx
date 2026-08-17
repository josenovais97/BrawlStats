import type { Metadata } from 'next';
import { Swords } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { getBrawlerMap, getMapMap } from '@/lib/brawlapi';
import { formatNumber, formatPercent, humanizeMode } from '@/lib/format';
import { getRankedMapPicks } from '@/lib/stats';
import type { BABrawler, BAMap } from '@/types/brawlapi';
import type { RankedMapPicks } from '@/types/stats';

export const metadata: Metadata = {
  title: 'Ranked maps',
  description:
    'Best Brawl Stars brawlers for every map in the Ranked rotation, from sampled competitive battles.',
};

/** Own aggregate plus artwork, so an hour is plenty. */
export const revalidate = 3600;

export default async function RankedPage() {
  const [maps, mapMeta, brawlerMeta] = await Promise.all([
    getRankedMapPicks(3),
    getMapMap().catch(() => new Map<number, BAMap>()),
    getBrawlerMap().catch(() => new Map<number, BABrawler>()),
  ]);

  // Grouped by mode so the page reads like the in-game rotation rather than a
  // flat list of thirty maps.
  const byMode = new Map<string, RankedMapPicks[]>();
  for (const map of maps) {
    const list = byMode.get(map.mode) ?? [];
    list.push(map);
    byMode.set(map.mode, list);
  }

  const totalSamples = maps.reduce((sum, m) => sum + m.sampleSize, 0);

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow flex items-center gap-2 text-accent">
          <Swords className="size-3.5" />
          Competitive only
        </p>
        <h1 className="display mt-2.5 text-3xl uppercase sm:text-4xl">Ranked maps</h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted">
          The strongest brawlers on each map in the Ranked rotation, from{' '}
          {formatNumber(totalSamples)} sampled Ranked battles. Trophy-ladder games are
          excluded entirely: Ranked matchmaking pairs comparable opponents, so what is
          left reflects the brawler rather than who was holding it.
        </p>
      </header>

      {maps.length === 0 ? (
        <div className="card card-glow mx-auto max-w-xl p-8 text-center">
          <h2 className="display text-xl uppercase">Collecting map data</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Map names are recorded on newly sampled battles only, and the battle log
            reaches back about 25 matches, so this fills in over the next day or two as
            the sampler works through the pool.
          </p>
          <Link
            href="/tier-list"
            className="mt-6 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
          >
            See the overall tier list
          </Link>
        </div>
      ) : (
        [...byMode].map(([mode, list]) => (
          <section key={mode} aria-labelledby={`mode-${mode}`}>
            <h2
              id={`mode-${mode}`}
              className="display mb-4 text-2xl uppercase sm:text-3xl"
            >
              {humanizeMode(mode)}
            </h2>

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((map) => (
                <li key={`${map.mode}-${map.mapName}`}>
                  <MapCard map={map} mapMeta={mapMeta} brawlerMeta={brawlerMeta} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function MapCard({
  map,
  mapMeta,
  brawlerMeta,
}: {
  map: RankedMapPicks;
  mapMeta: Map<number, BAMap>;
  brawlerMeta: Map<number, BABrawler>;
}) {
  const art = map.eventId ? mapMeta.get(map.eventId) : undefined;

  return (
    <article className="card flex h-full flex-col overflow-hidden">
      <div className="relative h-28 shrink-0 overflow-hidden bg-surface-2">
        {art?.imageUrl ? (
          <Image
            src={art.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 92vw"
            className="object-cover object-center opacity-70"
            loading="lazy"
            unoptimized
          />
        ) : null}
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-surface via-surface/70 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="display truncate text-base leading-none">{map.mapName}</p>
          <p className="mt-1 text-[0.625rem] uppercase tracking-wide text-muted">
            {formatNumber(map.sampleSize)} ranked battles ·{' '}
            {formatPercent(map.baselineWinRate)} map avg
          </p>
        </div>
      </div>

      <ol className="flex-1 divide-y divide-border">
        {map.picks.map((pick, index) => {
          const meta = brawlerMeta.get(pick.brawlerId);
          return (
            <li key={pick.brawlerId}>
              <Link
                href={`/brawlers/${pick.brawlerId}`}
                title={`${pick.brawlerName}: ${formatPercent(pick.winRate)} win rate over ${pick.decidedSampleSize} sampled Ranked battles on this map`}
                className="row-interactive flex items-center gap-2.5 px-3 py-2"
              >
                <span className="w-3 shrink-0 text-center text-[0.625rem] font-black tabular-nums text-muted">
                  {index + 1}
                </span>
                <Image
                  src={meta?.imageUrl ?? ''}
                  alt=""
                  width={30}
                  height={30}
                  className="size-[30px] shrink-0 rounded-md bg-surface-2"
                  loading="lazy"
                  unoptimized
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold capitalize">
                  {pick.brawlerName.toLowerCase()}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-bold tabular-nums text-victory">
                    {formatPercent(pick.winRate)}
                  </span>
                  {/* Sample size is never hidden: on a per-map split it is the
                      difference between a signal and a coin flip. */}
                  <span className="block text-[0.5625rem] tabular-nums text-muted">
                    {pick.decidedSampleSize} battles
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
