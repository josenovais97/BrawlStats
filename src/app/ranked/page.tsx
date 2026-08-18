import type { Metadata } from 'next';
import { Swords } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { MapPreview } from '@/components/ranked/map-preview';
import { brawlerIconUrl, getBrawlerMap, getGameModeMap, getMapMap } from '@/lib/brawlapi';
import { formatNumber, formatPercent, humanizeMode } from '@/lib/format';
import { getRankedMapPicks } from '@/lib/stats';
import type { BABrawler, BAGameMode, BAMap } from '@/types/brawlapi';
import type { MapConfidence, RankedMapPicks } from '@/types/stats';

export const metadata: Metadata = {
  alternates: { canonical: '/ranked' },
  title: 'Ranked maps',
  description:
    'Best Brawl Stars brawlers for every map in the Ranked rotation, from sampled competitive battles.',
};

/** Own aggregate plus artwork, so an hour is plenty. */
export const revalidate = 3600;

const CONFIDENCE_LABEL: Record<MapConfidence, string> = {
  low: 'Thin sample',
  medium: 'Building',
  high: 'Well sampled',
};

export default async function RankedPage() {
  const [maps, mapMeta, modeMeta, brawlerMeta] = await Promise.all([
    getRankedMapPicks(3),
    getMapMap().catch(() => new Map<number, BAMap>()),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
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
  const baseline = maps[0]?.baselineWinRate ?? 0;
  const rated = maps.filter((m) => m.picks.length > 0).length;

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
        {maps.length > 0 ? (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            Every map is scored against the same {formatPercent(baseline)} sample-wide
            Ranked average, and each brawler&rsquo;s handful of battles here is weighed
            against its overall Ranked form — a map needs real evidence to move a
            brawler off that. {rated} of {maps.length} maps have enough to name a pick
            so far.
          </p>
        ) : null}
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
            href="/tier-list/ranked"
            className="mt-6 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
          >
            See the Ranked tier list
          </Link>
        </div>
      ) : (
        [...byMode].map(([mode, list]) => {
          const meta = modeMeta.get(mode.toLowerCase());
          const accent = meta?.color ?? '#8b95b8';

          return (
            <section key={mode} aria-labelledby={`mode-${mode}`}>
              <h2
                id={`mode-${mode}`}
                className="display mb-4 flex items-center gap-2.5 text-2xl uppercase sm:text-3xl"
              >
                {meta?.imageUrl ? (
                  <Image
                    src={meta.imageUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 shrink-0 object-contain"
                    unoptimized
                  />
                ) : null}
                <span style={{ color: accent }}>{meta?.name ?? humanizeMode(mode)}</span>
              </h2>

              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((map) => (
                  <li key={`${map.mode}-${map.mapName}`}>
                    <MapCard
                      map={map}
                      art={map.eventId ? mapMeta.get(map.eventId) : undefined}
                      modeLabel={meta?.name ?? humanizeMode(mode)}
                      accent={accent}
                      brawlerMeta={brawlerMeta}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function MapCard({
  map,
  art,
  modeLabel,
  accent,
  brawlerMeta,
}: {
  map: RankedMapPicks;
  art?: BAMap;
  modeLabel: string;
  accent: string;
  brawlerMeta: Map<number, BABrawler>;
}) {
  return (
    <article className="card flex h-full flex-col overflow-hidden">
      {/* The map itself gets the top of the card, drawn whole rather than
          cropped: a Brawl Stars map is read by its layout, and the old
          faded-and-cropped banner made every card look alike. */}
      <MapPreview
        imageUrl={art?.imageUrl}
        mapName={map.mapName}
        modeLabel={modeLabel}
        accent={accent}
      />

      <div className="border-y border-border px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="display min-w-0 flex-1 truncate text-base leading-tight">
            {map.mapName}
          </h3>
          {/* Deliberately quiet at "low": a caveat should not be the brightest
              thing on the card, and right now every map carries one. It picks
              up the mode colour once the map has earned it. */}
          <span
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wide"
            style={
              map.confidence === 'low'
                ? { color: 'var(--muted)', background: 'var(--surface-2)' }
                : { color: accent, background: `color-mix(in srgb, ${accent} 16%, transparent)` }
            }
          >
            {CONFIDENCE_LABEL[map.confidence]}
          </span>
        </div>
        <p className="mt-1.5 text-[0.625rem] uppercase tracking-wide text-muted">
          {formatNumber(map.sampleSize)} ranked battles · {map.brawlersSeen} brawlers
          seen
        </p>
      </div>

      {map.picks.length === 0 ? (
        /* Naming a "best pick" the sample cannot support is worse than naming
           none, so a thin map says so instead of ranking noise. */
        <p className="flex-1 px-3.5 py-4 text-xs leading-relaxed text-muted">
          No brawler is clearly above average here yet. The map has been sampled{' '}
          {formatNumber(map.sampleSize)} times, spread across {map.brawlersSeen}{' '}
          brawlers — not enough for any one of them to separate from the pack.
        </p>
      ) : (
        <ol className="flex-1 divide-y divide-border">
          {map.picks.map((pick, index) => {
            const meta = brawlerMeta.get(pick.brawlerId);
            // Positive means the brawler does better here than it does in
            // Ranked overall, which is the only genuinely map-specific claim
            // on the card.
            const edge = pick.score - pick.overallScore;

            return (
              <li key={pick.brawlerId}>
                <Link
                  href={`/brawlers/${pick.brawlerId}`}
                  title={`${pick.brawlerName}: ${formatPercent(pick.winRate)} raw win rate over ${pick.decidedSampleSize} sampled Ranked battles on this map, against ${formatPercent(pick.overallScore)} adjusted form over ${formatNumber(pick.overallSampleSize)} Ranked battles overall`}
                  className="row-interactive flex items-center gap-2.5 px-3.5 py-2"
                >
                  <span className="w-3 shrink-0 text-center text-[0.625rem] font-black tabular-nums text-muted">
                    {index + 1}
                  </span>
                  <Image
                    src={meta?.imageUrl ?? brawlerIconUrl(pick.brawlerId)}
                    alt=""
                    width={30}
                    height={30}
                    className="size-[30px] shrink-0 rounded-md bg-surface-2"
                    loading="lazy"
                    unoptimized
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold capitalize">
                      {pick.brawlerName.toLowerCase()}
                    </span>
                    {/* Sample size is never hidden: on a per-map split it is
                        the difference between a signal and a coin flip. */}
                    <span className="block text-[0.5625rem] tabular-nums text-muted">
                      {pick.decidedSampleSize} battles here
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {/* The adjusted score, not the raw rate: ranking is by
                        adjusted score, and printing the raw one makes the
                        column read as mis-sorted whenever a five-battle
                        sample had a flattering record. */}
                    <span className="block text-xs font-bold tabular-nums text-victory">
                      {formatPercent(pick.score)}
                    </span>
                    {/* Signed both ways. A pick can still be worth listing
                        while doing slightly worse here than it does in Ranked
                        generally, and hiding that half of the comparison was
                        what made the column unreadable. */}
                    <span
                      className={`block text-[0.5625rem] tabular-nums ${
                        edge >= 0.005 ? 'text-victory/80' : 'text-muted'
                      }`}
                    >
                      {edge >= 0.005 ? '+' : edge <= -0.005 ? '−' : '±'}
                      {Math.abs(edge * 100).toFixed(1)} vs usual
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}
