'use client';

import { ArrowUpDown, Search, Star, Trophy } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber } from '@/lib/format';
import type { BSPlayerBrawler } from '@/types/brawlstars';

/** Trimmed artwork metadata — the full brawler payload is far too big to ship. */
export interface BrawlerMetaLite {
  imageUrl: string;
  rarityColor: string;
  rarityName: string;
}

interface PlayerBrawlersProps {
  brawlers: BSPlayerBrawler[];
  meta: Record<string, BrawlerMetaLite>;
}

type SortKey = 'trophies' | 'rank' | 'power' | 'name';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'trophies', label: 'Trophies' },
  { key: 'rank', label: 'Rank' },
  { key: 'power', label: 'Power' },
  { key: 'name', label: 'Name' },
];

export function PlayerBrawlers({ brawlers, meta }: PlayerBrawlersProps) {
  const [sort, setSort] = useState<SortKey>('trophies');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? brawlers.filter((b) => b.name.toLowerCase().includes(q))
      : brawlers;

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'power':
          return b.power - a.power || b.trophies - a.trophies;
        case 'rank':
          return b.rank - a.rank || b.trophies - a.trophies;
        default:
          return b.trophies - a.trophies;
      }
    });
  }, [brawlers, query, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter brawlers"
            aria-label="Filter brawlers by name"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-brand/60"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          <ArrowUpDown className="mr-1 size-4 shrink-0 text-muted" />
          {SORTS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                sort === key
                  ? 'bg-brand text-[#1a1200]'
                  : 'border border-border text-muted hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="card p-6 text-sm text-muted">No brawlers match “{query}”.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visible.map((brawler) => (
            <BrawlerTile key={brawler.id} brawler={brawler} meta={meta[brawler.id]} />
          ))}
        </div>
      )}
    </div>
  );
}

function BrawlerTile({
  brawler,
  meta,
}: {
  brawler: BSPlayerBrawler;
  meta?: BrawlerMetaLite;
}) {
  const accent = meta?.rarityColor ?? '#8b95b8';
  const gearCount = brawler.gears?.length ?? 0;

  return (
    <Link
      href={`/brawlers/${brawler.id}`}
      className="card group relative overflow-hidden p-3 transition-transform hover:-translate-y-0.5"
      style={{ borderColor: `color-mix(in srgb, ${accent} 35%, transparent)` }}
    >
      <span
        className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: accent }}
      />

      <div className="relative">
        <Image
          src={meta?.imageUrl ?? brawlerIconUrl(brawler.id)}
          alt={brawler.name}
          width={120}
          height={120}
          className="mx-auto aspect-square w-full max-w-[96px] object-contain"
          unoptimized
        />
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-md px-2 py-0.5 text-xs font-black text-[#1a1200] shadow"
          style={{ background: 'var(--brand)' }}
        >
          {brawler.power}
        </span>
      </div>

      <p className="mt-3 truncate text-center text-sm font-bold capitalize">
        {brawler.name.toLowerCase()}
      </p>

      <div className="mt-2 flex items-center justify-center gap-3 text-xs">
        <span className="flex items-center gap-1 tabular-nums text-brand">
          <Trophy className="size-3" />
          {formatNumber(brawler.trophies)}
        </span>
        <span className="flex items-center gap-1 tabular-nums text-muted">
          <Star className="size-3" />
          {brawler.rank}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted">
        <span title="Star powers">{brawler.starPowers.length} SP</span>
        <span aria-hidden>·</span>
        <span title="Gadgets">{brawler.gadgets.length} GD</span>
        {gearCount > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span title="Gears">{gearCount} GR</span>
          </>
        ) : null}
      </div>
    </Link>
  );
}
