'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';

/** Only what the grid renders — keeps the client payload small. */
export interface BrawlerCardData {
  id: number;
  name: string;
  imageUrl: string;
  /** Null when no source knows it — rendered as nothing, never as "Unknown". */
  className: string | null;
  rarityName: string | null;
  rarityColor: string;
  /** "legacy" brawlers are kept for their history but are not playable. */
  status: 'current' | 'legacy';
}

/** Ordered by in-game progression so the filter row reads naturally. */
const RARITY_ORDER = [
  'Common',
  'Rare',
  'Super Rare',
  'Epic',
  'Mythic',
  'Legendary',
  'Ultra Legendary',
];

/**
 * Sorts built from data the page already has.
 *
 * Nothing here needs a win rate or a fetch: ids are release order, which is
 * the one ordering people ask for by name ("what came out last"), and rarity
 * is already on every card.
 */
const SORTS = {
  release: { label: 'Release order', compare: (a: BrawlerCardData, b: BrawlerCardData) => a.id - b.id },
  newest: { label: 'Newest first', compare: (a: BrawlerCardData, b: BrawlerCardData) => b.id - a.id },
  name: {
    label: 'Name A–Z',
    compare: (a: BrawlerCardData, b: BrawlerCardData) => a.name.localeCompare(b.name),
  },
  rarity: {
    label: 'Rarest first',
    compare: (a: BrawlerCardData, b: BrawlerCardData) =>
      rarityRank(b.rarityName) - rarityRank(a.rarityName) || a.id - b.id,
  },
} as const;

type SortKey = keyof typeof SORTS;

/** Unknown rarities sort below every known one rather than above Common. */
function rarityRank(rarity: string | null): number {
  const index = rarity ? RARITY_ORDER.indexOf(rarity) : -1;
  return index === -1 ? -1 : index;
}

/**
 * The brawler index, as a browser rather than as a stack of loose controls.
 *
 * The search box, the two filter rows and the result count used to be four
 * separate things drifting down the page, and the count sat below the panel
 * where it read as a caption for the grid instead of as feedback from the
 * filters. They are one toolbar now: query and sort on top, filters in the
 * middle, and what the filters produced in the footer next to the control that
 * undoes them.
 */
export function BrawlerBrowser({ brawlers }: { brawlers: BrawlerCardData[] }) {
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState('all');
  const [brawlerClass, setBrawlerClass] = useState('all');
  const [sort, setSort] = useState<SortKey>('release');
  const searchId = useId();
  const sortId = useId();

  const rarities = useMemo(() => {
    const present = new Set(
      brawlers.map((b) => b.rarityName).filter((r): r is string => Boolean(r)),
    );
    const known = RARITY_ORDER.filter((r) => present.has(r));
    const extra = [...present].filter((r) => !RARITY_ORDER.includes(r)).sort();
    return [...known, ...extra];
  }, [brawlers]);

  const classes = useMemo(
    () =>
      [...new Set(brawlers.map((b) => b.className).filter((c): c is string => Boolean(c)))].sort(),
    [brawlers],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return brawlers
      .filter(
        (b) =>
          (!q || b.name.toLowerCase().includes(q)) &&
          (rarity === 'all' || b.rarityName === rarity) &&
          (brawlerClass === 'all' || b.className === brawlerClass),
      )
      .sort(SORTS[sort].compare);
  }, [brawlers, query, rarity, brawlerClass, sort]);

  const filtered = query.trim() !== '' || rarity !== 'all' || brawlerClass !== 'all';

  const reset = () => {
    setQuery('');
    setRarity('all');
    setBrawlerClass('all');
  };

  return (
    <div>
      <div className="card overflow-hidden">
        {/* Query and sort. The field is the loudest control in the toolbar
            because typing a name is what almost everyone does here. */}
        <div className="flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center sm:p-4">
          <div className="group relative min-w-0 flex-1">
            <label htmlFor={searchId} className="sr-only">
              Search brawlers by name
            </label>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted transition-colors group-focus-within:text-brand"
            />
            <input
              id={searchId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brawlers"
              type="search"
              autoComplete="off"
              className="min-h-12 w-full rounded-xl border border-border-strong/70 bg-surface-2 py-2 pl-11 pr-10 text-base outline-none transition-colors placeholder:text-muted/60 focus:border-brand/70"
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

          <div className="flex shrink-0 items-center gap-2">
            <label
              htmlFor={sortId}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"
            >
              <SlidersHorizontal aria-hidden className="size-4" />
              Sort
            </label>
            <select
              id={sortId}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="min-h-12 flex-1 rounded-xl border border-border bg-surface-2 px-3 text-sm font-medium outline-none transition-colors focus:border-brand/70 sm:flex-none"
            >
              {Object.entries(SORTS).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2 border-t border-border p-3 sm:p-4">
          <FilterRow
            label="Rarity"
            options={rarities}
            value={rarity}
            onChange={setRarity}
          />
          <FilterRow
            label="Class"
            options={classes}
            value={brawlerClass}
            onChange={setBrawlerClass}
          />
        </div>

        {/* Feedback from the filters, next to the control that undoes them. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border bg-surface-2/40 px-3 py-2.5 sm:px-4">
          <p className="text-sm text-muted">
            <strong className="font-bold tabular-nums text-foreground">
              {visible.length}
            </strong>{' '}
            {visible.length === 1 ? 'brawler' : 'brawlers'}
            {filtered ? ` of ${brawlers.length}` : ''}
          </p>
          {filtered ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-muted transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card mt-4 p-6 text-center">
          <p className="text-sm text-muted">No brawlers match those filters.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-muted transition-colors hover:border-brand/50 hover:text-foreground"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((brawler) => (
            <li key={brawler.id}>
              <BrawlerCard brawler={brawler} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One brawler.
 *
 * The portrait and the name are the card; everything else is one quiet line
 * underneath. Star power and gadget counts used to sit below that, and they
 * are the same two numbers on almost every brawler — three lines of chrome
 * that pushed the portrait down and made a two-column phone layout tall enough
 * to fit four cards on a screen.
 */
function BrawlerCard({ brawler }: { brawler: BrawlerCardData }) {
  return (
    <Link
      href={`/brawlers/${brawler.id}`}
      className="card card-interactive group relative flex h-full flex-col overflow-hidden p-2.5 sm:p-3"
      style={{
        borderColor: `color-mix(in srgb, ${brawler.rarityColor} 32%, transparent)`,
      }}
    >
      {/* The rarity reads off the plate behind the portrait as well as off the
          label, so a Legendary is recognisable before anything is read. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-70"
        style={{
          background: `radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, ${brawler.rarityColor} 22%, transparent), transparent 70%)`,
        }}
      />

      {brawler.status === 'legacy' ? (
        <span
          className="absolute left-2 top-2 z-10 rounded-md bg-surface-3/90 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-muted"
          title="No longer available in the game. Kept for its history."
        >
          Legacy
        </span>
      ) : null}

      <Image
        src={brawler.imageUrl}
        alt={brawler.name}
        width={140}
        height={140}
        sizes="(max-width: 640px) 45vw, 180px"
        className="relative mx-auto aspect-square w-full max-w-[7rem] object-contain duration-200 group-hover:scale-105 motion-safe:transition-transform"
        unoptimized
      />

      <p className="relative mt-1.5 truncate text-center font-bold capitalize">
        {brawler.name.toLowerCase()}
      </p>

      {/* One line, not three: rarity carries the colour, class stays quiet. */}
      <p className="relative mt-0.5 flex min-w-0 items-center justify-center gap-1.5 text-xs">
        {brawler.rarityName ? (
          <span
            className="truncate font-semibold"
            style={{ color: brawler.rarityColor }}
          >
            {brawler.rarityName}
          </span>
        ) : null}
        {brawler.rarityName && brawler.className ? (
          <span aria-hidden className="text-muted/40">
            ·
          </span>
        ) : null}
        {/* Omitted rather than shown as a placeholder when unknown. */}
        {brawler.className ? (
          <span className="truncate text-muted">{brawler.className}</span>
        ) : null}
      </p>
    </Link>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    /* The label sits above the pills on a phone: a fixed label column plus a
       scrolling pill row left roughly 250px for the pills at 320px wide, which
       is two of them. */
    <div className="sm:flex sm:items-center sm:gap-3">
      <span
        id={`filter-${label}`}
        className="block shrink-0 text-xs font-semibold uppercase tracking-wide text-muted sm:w-12"
      >
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`filter-${label}`}
        className="-mx-3 mt-1.5 flex items-center gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:mt-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
      >
        {['all', ...options].map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={`inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-brand text-brand-ink'
                  : 'border border-border bg-surface-2/60 text-muted hover:border-border-strong hover:text-foreground'
              }`}
            >
              {option === 'all' ? 'All' : option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
