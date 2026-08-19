'use client';

import { Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { GadgetIcon, StarPowerIcon } from '@/components/game-icons';

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
  starPowers: number;
  gadgets: number;
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

export function BrawlerBrowser({ brawlers }: { brawlers: BrawlerCardData[] }) {
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState('all');
  const [brawlerClass, setBrawlerClass] = useState('all');

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
    return brawlers.filter(
      (b) =>
        (!q || b.name.toLowerCase().includes(q)) &&
        (rarity === 'all' || b.rarityName === rarity) &&
        (brawlerClass === 'all' || b.className === brawlerClass),
    );
  }, [brawlers, query, rarity, brawlerClass]);

  return (
    <div>
      <div className="card space-y-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brawlers"
            aria-label="Search brawlers by name"
            className="w-full rounded-lg border border-border bg-surface-2 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-brand/60"
          />
        </div>

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

      <p className="mt-4 text-sm text-muted">
        Showing {visible.length} of {brawlers.length} brawlers
      </p>

      {visible.length === 0 ? (
        <p className="card mt-4 p-6 text-sm text-muted">
          No brawlers match those filters.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((brawler) => (
            <Link
              key={brawler.id}
              href={`/brawlers/${brawler.id}`}
              className="card card-interactive group overflow-hidden p-3"
              style={{
                borderColor: `color-mix(in srgb, ${brawler.rarityColor} 35%, transparent)`,
              }}
            >
              <Image
                src={brawler.imageUrl}
                alt={brawler.name}
                width={140}
                height={140}
                className="mx-auto aspect-square w-full max-w-[110px] object-contain"
                unoptimized
              />
              <p className="mt-2 truncate text-center font-bold capitalize">
                {brawler.name.toLowerCase()}
              </p>
              {brawler.rarityName ? (
                <p
                  className="mt-0.5 truncate text-center text-xs font-semibold"
                  style={{ color: brawler.rarityColor }}
                >
                  {brawler.rarityName}
                </p>
              ) : null}
              {/* Omitted rather than shown as a placeholder when unknown. */}
              {brawler.className ? (
                <p className="mt-0.5 truncate text-center text-xs text-muted">
                  {brawler.className}
                </p>
              ) : null}
              {brawler.status === 'legacy' ? (
                <p className="mt-1 text-center">
                  <span
                    className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-muted"
                    title="No longer available in the game. Kept for its history."
                  >
                    Legacy
                  </span>
                </p>
              ) : null}
              <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted">
                <span className="flex items-center gap-1" title="Star powers">
                  <StarPowerIcon className="size-3" />
                  {brawler.starPowers}
                </span>
                <span className="flex items-center gap-1" title="Gadgets">
                  <GadgetIcon className="size-3" />
                  {brawler.gadgets}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
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
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <div className="flex flex-1 items-center gap-1 overflow-x-auto pb-1">
        {['all', ...options].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              value === option
                ? 'bg-brand text-[#1a1200]'
                : 'border border-border text-muted hover:text-foreground'
            }`}
          >
            {option === 'all' ? 'All' : option}
          </button>
        ))}
      </div>
    </div>
  );
}
