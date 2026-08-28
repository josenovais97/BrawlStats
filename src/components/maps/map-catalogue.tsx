'use client';

import Link from 'next/link';
import { ArrowLeft, Search, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { MapArt } from '@/components/maps/map-art';

/** The minimum a card needs. The full BAMap payload never reaches the client. */
export interface CatalogueMap {
  id: number;
  name: string;
  modeSlug: string;
  mapSlug: string;
  imageUrl?: string;
}

export interface CatalogueGroup {
  mode: string;
  label: string;
  maps: CatalogueMap[];
}

/**
 * The full map catalogue, as a directory rather than a wall.
 *
 * Four hundred maps used to render as four hundred cards in one document —
 * 20,000 px of scroll, 400 image requests, and no way to find a named map
 * except the browser's own find-in-page. Every other index on the site has
 * controls; the largest one had none.
 *
 * Capping each mode to a preview was the obvious fix and barely moved it: the
 * game has forty-one modes, most of them holding fewer than eight maps, so a
 * per-mode cap removed fifty cards out of four hundred. What the page is
 * actually indexing is *modes* — the map you want is always reached through
 * the mode you play — so that is what it shows first, and a mode opens into
 * its own maps in place.
 *
 * Three shapes for three questions. Search gives a flat list across every mode,
 * because when you know the name the mode is not what you are looking for. A
 * chosen mode gives that mode whole. Neither gives the directory.
 *
 * Nothing is hidden from a crawler by any of it -- but only because the
 * directory cards are real links. They were `<button onClick={setMode}>` until
 * 2026-08-27, which meant the served HTML contained zero `/maps/[mode]` links
 * and the mode pages, plus the ~400 map pages they list, were reachable only
 * from the sitemap. The comment above this one had claimed otherwise for
 * weeks; a claim about crawlability is worth a `curl | grep`, because nothing
 * else fails when it stops being true.
 */
export function MapCatalogue({ groups }: { groups: CatalogueGroup[] }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<string | null>(null);
  const searchId = useId();

  const total = useMemo(() => groups.reduce((sum, group) => sum + group.maps.length, 0), [groups]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return groups.flatMap((group) =>
      group.maps
        .filter((map) => map.name.toLowerCase().includes(q))
        .map((map) => ({ ...map, modeLabel: group.label })),
    );
  }, [groups, query]);

  const open = mode ? groups.find((group) => group.mode === mode) : null;

  return (
    <div className="space-y-5">
      <div className="card relative overflow-hidden">
        <label htmlFor={searchId} className="sr-only">
          Search maps
        </label>
        <Search
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${total} maps by name`}
          className="min-h-12 w-full bg-transparent pl-11 pr-11 text-sm outline-none placeholder:text-muted/85"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {matches ? (
        matches.length === 0 ? (
          <p className="card p-6 text-sm text-muted">No map matches “{query}”.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              <span className="font-semibold text-foreground">{matches.length}</span>{' '}
              {matches.length === 1 ? 'map' : 'maps'} matching “{query}”
            </p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {matches.map((map) => (
                <MapCard key={`${map.modeSlug}-${map.id}`} map={map} sublabel={map.modeLabel} />
              ))}
            </ul>
          </div>
        )
      ) : open ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMode(null)}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 text-xs font-semibold text-muted transition-colors hover:border-border-strong hover:text-foreground"
            >
              <ArrowLeft aria-hidden className="size-4" />
              All modes
            </button>
            <Link
              href={`/maps/${open.mode}`}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              Open the {open.label.toLowerCase()} page
            </Link>
          </div>

          <div className="flex items-start gap-3">
            <span className="rule mt-1" aria-hidden />
            <h3 className="display text-2xl uppercase">
              {open.label}{' '}
              <span className="text-base normal-case tracking-normal text-muted">
                {open.maps.length} maps
              </span>
            </h3>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {open.maps.map((map) => (
              <MapCard key={map.id} map={map} />
            ))}
          </ul>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {groups.map((group) => (
            <li key={group.mode}>
              {/*
                A real link that behaves like a button. It has to be an <a
                href> because a crawler cannot click: as a plain <button> this
                directory was the only route to 41 mode pages and, through
                them, ~400 map pages -- and every one of them was orphaned,
                sitting in the sitemap with nothing linking to it. Measured
                2026-08-27: 0 mode links in the served HTML against 41 in the
                sitemap.

                The click handler keeps the in-place open for anyone with JS,
                and bails on modified clicks so ctrl/cmd/middle-click still
                open the mode page in a new tab like any other link.
              */}
              <Link
                href={`/maps/${group.mode}`}
                prefetch={false}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  setMode(group.mode);
                }}
                className="card card-interactive group block h-full w-full overflow-hidden text-left"
              >
                <MapArt
                  src={group.maps[0]?.imageUrl}
                  alt=""
                  height="h-24"
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
                />
                <span className="block truncate px-3 pt-2 text-sm font-semibold">
                  {group.label}
                </span>
                <span className="block px-3 pb-2 text-[0.6875rem] uppercase tracking-wide text-muted">
                  {group.maps.length} {group.maps.length === 1 ? 'map' : 'maps'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MapCard({ map, sublabel }: { map: CatalogueMap; sublabel?: string }) {
  return (
    <li>
      {/* Not prefetched. /maps lists the whole catalogue — around 400 of
          these — and each is a cold ISR entry, so prefetching a screenful
          renders map pages nobody opened and pays an ISR write for each. */}
      <Link
        href={`/maps/${map.modeSlug}/${map.mapSlug}`}
        prefetch={false}
        className="card card-interactive group block h-full overflow-hidden"
      >
        <MapArt
          src={map.imageUrl}
          alt=""
          height="h-28"
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
        />
        <span className="block truncate px-3 pt-2 text-sm font-semibold">{map.name}</span>
        {sublabel ? (
          <span className="block truncate px-3 pb-2 text-[0.6875rem] uppercase tracking-wide text-muted">
            {sublabel}
          </span>
        ) : (
          <span className="block pb-2" />
        )}
      </Link>
    </li>
  );
}
