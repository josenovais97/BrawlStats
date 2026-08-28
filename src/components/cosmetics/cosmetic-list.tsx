'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { playerIconUrl } from '@/lib/brawlapi';
import { formatNumber, formatPercent } from '@/lib/format';
import { brawlerPath } from '@/lib/slugs';
import type { CosmeticUsage } from '@/lib/stats';

/**
 * The full catalogue of one cosmetic kind, ranked by how many people wear it.
 *
 * Every row is rendered on the server; the search box only hides rows it has
 * already sent. That distinction matters here — the map catalogue put its
 * contents behind a click and quietly orphaned four hundred pages, and the fix
 * was to stop making the markup depend on interaction.
 *
 * There is no page per cosmetic on purpose. Around 1,200 skins and 500 icons
 * would nearly triple the crawlable surface of the site for pages carrying one
 * number each, and this box has two cores.
 *
 * Only the first chunk of rows is rendered. The full list rendered at once was
 * 1.1 MB of markup for the skins page -- the data itself is a fraction of that,
 * so it all travels in the payload and search still spans every row; what is
 * capped is the DOM, not the dataset. Nothing is orphaned by this, because no
 * row links anywhere a crawler needs to follow.
 */
const FIRST_PAGE = 250;
export function CosmeticList({
  items,
  kind,
  art,
}: {
  items: CosmeticUsage[];
  kind: 'skin' | 'icon';
  /** Skin artwork by `${brawler}|${skin}` key; icons resolve from their id. */
  art?: Record<string, string>;
}) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Rank is assigned once, from the unfiltered order, so a search narrows the
  // list without renumbering it -- and so the row does not call indexOf, which
  // would be quadratic across twelve hundred rows on every keystroke.
  const ranked = useMemo(
    () => items.map((item, index) => ({ item, rank: index + 1 })),
    [items],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter(
      ({ item }) =>
        item.name.toLowerCase().includes(q) ||
        (item.brawlerName ?? '').toLowerCase().includes(q),
    );
  }, [ranked, query]);

  // A search is already a narrowing, so it shows everything it found.
  const searching = query.trim().length > 0;
  const visible = searching || showAll ? matches : matches.slice(0, FIRST_PAGE);

  const isIcon = kind === 'icon';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={isIcon ? 'Search icons by number' : 'Search by skin or brawler'}
          aria-label={isIcon ? 'Search profile icons' : 'Search skins'}
          className="min-h-11 flex-1 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-brand"
        />
        <p className="text-sm text-muted">
          <span className="font-semibold text-foreground">{formatNumber(matches.length)}</span>{' '}
          of {formatNumber(items.length)}
        </p>
      </div>

      {matches.length === 0 ? (
        <p className="card p-6 text-sm text-muted">Nothing matches &ldquo;{query}&rdquo;.</p>
      ) : (
        <ol className="card divide-y divide-border overflow-hidden">
          {visible.map(({ item, rank }, index) => (
            <li key={`${item.id}-${item.brawlerId ?? 0}`} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted">
                {rank}
              </span>

              <CosmeticArt
                src={
                  isIcon
                    ? playerIconUrl(item.id)
                    : (art?.[`${item.brawlerName ?? ''}|${item.name}`] ?? null)
                }
                eager={index < 24}
              />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold capitalize">
                  {item.name.toLowerCase()}
                </span>
                {item.brawlerName && item.brawlerId ? (
                  <Link
                    href={brawlerPath(item.brawlerId, item.brawlerName)}
                    className="text-xs capitalize text-muted transition-colors hover:text-brand"
                  >
                    {item.brawlerName.toLowerCase()}
                  </Link>
                ) : null}
              </span>

              <span className="shrink-0 text-right">
                <span className="block text-sm font-bold tabular-nums">
                  {formatPercent(item.share)}
                </span>
                <span className="block text-xs tabular-nums text-muted">
                  {formatNumber(item.users)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {!searching && !showAll && matches.length > FIRST_PAGE ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="btn-game w-full bg-surface-2 py-3 text-sm uppercase hover:bg-surface-3"
        >
          Show all {formatNumber(matches.length)}
        </button>
      ) : null}
    </div>
  );
}

/** The picture, or a quiet placeholder when there is no file for it. */
function CosmeticArt({ src, eager }: { src: string | null; eager: boolean }) {
  if (!src) {
    return (
      <span
        aria-hidden
        className="size-9 shrink-0 rounded-lg border border-dashed border-border bg-surface-2"
      />
    );
  }
  return (
    <Image
      src={src}
      alt=""
      width={36}
      height={36}
      className="size-9 shrink-0 rounded-lg bg-surface-2 object-cover"
      loading={eager ? 'eager' : 'lazy'}
      unoptimized
    />
  );
}
