'use client';

import Image from 'next/image';
import Link from 'next/link';
import { type ReactNode, useSyncExternalStore } from 'react';

import { brawlerPath } from '@/lib/slugs';

/** One brawler's record on one Ranked map, as the page serialises it. */
export interface MapPickRow {
  brawlerId: number;
  brawlerName: string;
  imageUrl: string;
  /** Baseline-adjusted, shrunk. What the ordering uses. */
  score: number;
  /** The same brawler's form across all Ranked maps, for the delta. */
  overallScore: number;
  /** Decided battles sampled on this map. */
  battles: number;
}

export interface MapRows {
  mapName: string;
  slug: string;
  picks: MapPickRow[];
}

/**
 * The map chips under the mode chips on the Ranked tier list, and what they
 * swap in.
 *
 * Client-side, and deliberately not a route. The Bubble's panel has had this
 * since 1.7 and it is the thing people actually draft on — Ranked hands you one
 * map from the mode's pool and the answer moves with it — so the site's list
 * was the poorer of the two. But a `/tier-list/ranked/<mode>/<map>` segment is
 * exactly the shape AGENTS.md trap 5 warns about: every one of those is a
 * render, and the map pages under `/maps` already answer "best brawlers on
 * <map>" as documents. So the mode page carries its maps' rankings in the
 * payload — five maps of sixty rows is a few kilobytes — and switching is a
 * click, not a request. The map's own page is linked for the reader who wants
 * the long version.
 *
 * The selection lives in the URL fragment so a map view can be shared, and in
 * the fragment rather than the query string because reading `searchParams` on
 * the server is what opts a route out of caching (trap 5 again). The fragment
 * never reaches the server; it is read once on mount.
 *
 * The tiers arrive as `children` from the server component and are shown
 * untouched when no map is chosen, which is the whole reason this is a wrapper
 * rather than a sibling: the tier rows stay server-rendered.
 */
export function RankedMapSwitch({
  maps,
  children,
}: {
  maps: MapRows[];
  children: ReactNode;
}) {
  /*
   * The fragment is the state, read through `useSyncExternalStore` so the
   * server snapshot is "nothing chosen" and the client's first render agrees
   * with it — a `useState` initialised from `window.location` would hydrate
   * against markup that had never seen it.
   */
  const hash = useSyncExternalStore(subscribeToHash, readHash, () => '');
  const selected = hash.startsWith('#map=') ? decodeURIComponent(hash.slice(5)) : null;

  const choose = (slug: string | null) => {
    // Replace, not push: a chip is a filter, and filters should not fill the
    // back stack. `replaceState` fires no `hashchange`, so it is raised by hand.
    const url = slug ? `#map=${slug}` : window.location.pathname + window.location.search;
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  if (maps.length === 0) return <>{children}</>;

  const chip = 'shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors';
  const on = 'border-victory/40 bg-victory/10 text-victory';
  const off = 'border-border bg-surface text-muted hover:text-foreground';
  const map = selected ? maps.find((m) => m.slug === selected) : undefined;

  return (
    <div className="space-y-4">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="group" aria-label="Ranked map" className="flex w-max gap-2">
          <button
            type="button"
            onClick={() => choose(null)}
            aria-pressed={map === undefined}
            className={`${chip} ${map ? off : on}`}
          >
            All maps
          </button>
          {maps.map((entry) => (
            <button
              key={entry.slug}
              type="button"
              onClick={() => choose(entry.slug)}
              aria-pressed={entry.slug === selected}
              className={`${chip} ${entry.slug === selected ? on : off}`}
            >
              {entry.mapName}
            </button>
          ))}
        </div>
      </div>

      {map ? <MapPicks map={map} /> : children}
    </div>
  );
}

/**
 * The per-map list. Same row as the Bubble's, because it is the same claim:
 * the delta against the brawler's own Ranked form is the only genuinely
 * map-specific number, so it is the one given colour. A brawler that is strong
 * everywhere is not a map pick; one that is better *here* than usual, is.
 */
function MapPicks({ map }: { map: MapRows }) {
  if (map.picks.length === 0) {
    return (
      <p className="card px-4 py-8 text-center text-sm leading-relaxed text-muted">
        No brawler on {map.mapName} has enough sampled battles to rank yet. It fills in as the
        sampler works through more battles here.
      </p>
    );
  }

  return (
    <ol className="card divide-y divide-border overflow-hidden">
      {map.picks.map((pick, index) => {
        const edge = pick.score - pick.overallScore;
        return (
          <li key={pick.brawlerId}>
            <Link
              href={brawlerPath(pick.brawlerId, pick.brawlerName)}
              className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-surface-2/60"
            >
              <span
                aria-hidden
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black tabular-nums ${
                  index === 0
                    ? 'bg-brand text-brand-ink'
                    : index === 1
                      ? 'bg-surface-3 text-foreground'
                      : index === 2
                        ? 'bg-[#8a5a2b] text-[#ffe6c7]'
                        : 'text-muted'
                }`}
              >
                {index + 1}
              </span>
              <Image
                src={pick.imageUrl}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-md bg-surface-2"
                loading="lazy"
                unoptimized
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold capitalize leading-tight">
                  {pick.brawlerName.toLowerCase()}
                </span>
                {/* Sample size is never hidden: on a per-map split it is the
                    difference between a signal and a coin flip. */}
                <span className="block text-xs tabular-nums leading-tight text-muted">
                  {pick.battles.toLocaleString()} battles here
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-black tabular-nums leading-tight text-victory">
                  {(pick.score * 100).toFixed(1)}%
                </span>
                <span
                  className={`block text-xs tabular-nums leading-tight ${
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
      <li className="px-3 py-2 text-xs text-muted">
        Adjusted win rate on this map over the last three weeks, shrunk toward each brawler&apos;s
        overall Ranked form where the sample is thin. Brawlers under 50 decided battles here are
        left out.{' '}
        <Link
          href={`/maps/${map.slug}`}
          className="font-semibold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-brand"
        >
          Full map page
        </Link>
      </li>
    </ol>
  );
}

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function readHash(): string {
  return window.location.hash;
}
