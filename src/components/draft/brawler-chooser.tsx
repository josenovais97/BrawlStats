'use client';

import { Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';

import { brawlerIconUrl } from '@/lib/brawlapi';

export interface ChooserBrawler {
  id: number;
  name: string;
  imageUrl: string;
  /** Where this brawler sits in the current map's pick order, if it ranks. */
  rank?: number;
}

/**
 * Finding one brawler among a hundred and nine.
 *
 * This was a labelled grid of the whole roster, alphabetical, and the labels
 * were the only concession to the fact that nobody recognises a hundred cropped
 * portraits. Choosing four brawlers meant four passes over the same wall.
 *
 * A client component so the filtering is instant, but every tile is still a
 * `Link` to the same URL the server rendered. The draft lives in the path, so
 * search must not become a second place where state hides: type to narrow,
 * click to navigate, and the resulting URL is identical to the one you would
 * have got by scrolling. It also means the picker still works with no
 * JavaScript — the input disappears, the grid does not.
 *
 * The suggested row is what makes the common case fast. Most drafts pick from
 * the handful of brawlers that are actually good on the map in front of you,
 * and those are already computed for the results below.
 */
export function BrawlerChooser({
  options,
  taken,
  label,
  hrefs,
  suggestedLabel = 'Best here',
}: {
  options: ChooserBrawler[];
  /** Everyone already named, on either side — nobody is drafted twice. */
  taken: number[];
  label: string;
  /**
   * Destination per brawler id, precomputed on the server.
   *
   * A `(id) => string` callback would be the natural shape and cannot cross
   * this boundary: React refuses to serialise a function into a client
   * component, and the page 500s at request time rather than failing to build.
   * The URLs are a pure function of state the server already holds, so it
   * hands over the answers instead of the means to compute them.
   */
  hrefs: Record<number, string>;
  suggestedLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const inputId = useId();

  const available = useMemo(
    () => options.filter((brawler) => !taken.includes(brawler.id)),
    [options, taken],
  );

  /*
   * Ranked brawlers first, best on this map at the front. Six is about a row on
   * a phone and stops the shortcut becoming a second grid.
   */
  const suggested = useMemo(
    () =>
      available
        .filter((brawler) => brawler.rank !== undefined)
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
        .slice(0, 6),
    [available],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...available].sort((a, b) => a.name.localeCompare(b.name));
    if (!needle) return sorted;
    /*
     * Prefix matches lead, because a search for "sh" means Shelly before Shade
     * before Nani — a brawler whose name merely contains the letters is the
     * weaker match and should not outrank one that starts with them.
     */
    const starts = sorted.filter((b) => b.name.toLowerCase().startsWith(needle));
    const contains = sorted.filter(
      (b) => !b.name.toLowerCase().startsWith(needle) && b.name.toLowerCase().includes(needle),
    );
    return [...starts, ...contains];
  }, [available, query]);

  return (
    <div className="mt-4 border-t border-border pt-4">
      <label
        htmlFor={inputId}
        className="mb-2.5 block text-xs font-bold uppercase tracking-wide text-muted"
      >
        {label}
      </label>

      <div className="group relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-brand"
        />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search brawlers"
          autoComplete="off"
          className="min-h-11 w-full rounded-xl border border-border-strong/70 bg-surface-2 py-2 pl-10 pr-10 text-base outline-none transition-colors placeholder:text-muted/85 focus:border-brand/70"
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

      {suggested.length > 0 && !query ? (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
            {suggestedLabel}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {suggested.map((brawler) => (
              <li key={brawler.id}>
                <Link
                  href={hrefs[brawler.id]}
                  rel="nofollow"
                  prefetch={false}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2/60 py-1 pl-1 pr-2.5 text-xs font-semibold capitalize transition-colors hover:border-brand/50"
                >
                  <Image
                    src={brawler.imageUrl || brawlerIconUrl(brawler.id)}
                    alt=""
                    width={24}
                    height={24}
                    className="size-6 shrink-0 rounded-md"
                    unoptimized
                  />
                  {brawler.name.toLowerCase()}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
        Four across on the narrowest phones rather than three, with the tile
        shrunk to match: the picker used to fill most of a small screen with a
        third of the roster, so choosing anyone meant scrolling the page away
        from the board you are filling in.
      */}
      <ul className="mt-3 grid max-h-72 grid-cols-4 gap-1 overflow-y-auto pr-1 sm:max-h-80 sm:grid-cols-6 sm:gap-1.5 lg:grid-cols-9">
        {filtered.map((brawler) => (
          <li key={brawler.id}>
            <Link
              href={hrefs[brawler.id]}
              rel="nofollow"
              prefetch={false}
              className="flex flex-col items-center gap-1 rounded-lg p-1 transition-colors hover:bg-surface-2 sm:p-1.5"
            >
              <Image
                src={brawler.imageUrl || brawlerIconUrl(brawler.id)}
                alt=""
                width={40}
                height={40}
                className="size-9 shrink-0 sm:size-10"
                loading="lazy"
                unoptimized
              />
              <span className="w-full truncate text-center text-[11px] font-medium capitalize leading-tight text-muted">
                {brawler.name.toLowerCase()}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No brawler matches &ldquo;{query}&rdquo;.
        </p>
      ) : null}
    </div>
  );
}
