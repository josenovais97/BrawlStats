'use client';

import { ArrowUpDown, Search, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { TrophyIcon } from '@/components/game-icons';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber } from '@/lib/format';
import { TIER_COLOR } from '@/lib/tiers';
import type { BSPlayerBrawler } from '@/types/brawlstars';
import type { Tier } from '@/types/stats';

/** How far below its own record a brawler currently sits. Never negative. */
function peakGap(brawler: BSPlayerBrawler): number {
  return Math.max(0, brawler.highestTrophies - brawler.trophies);
}

/** Trimmed artwork metadata — the full brawler payload is far too big to ship. */
export interface BrawlerMetaLite {
  imageUrl: string;
  rarityColor: string;
  rarityName: string;
  /**
   * Standing on the current trophy tier list. Absent when the brawler is below
   * the sample floor, or when no database is configured — the tile then simply
   * shows no chip rather than an invented one.
   */
  tier?: Tier;
  metaScore?: number;
}

interface PlayerBrawlersProps {
  brawlers: BSPlayerBrawler[];
  meta: Record<string, BrawlerMetaLite>;
}

type SortKey = 'trophies' | 'meta' | 'peak' | 'rank' | 'power' | 'name';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'trophies', label: 'Trophies' },
  // The reason the tier list exists, applied to the roster: "which of mine are
  // actually good right now".
  { key: 'meta', label: 'Meta' },
  // Sorts by how far below their own peak each brawler sits, which is where a
  // losing streak or a fresh reset shows up.
  { key: 'peak', label: 'Off peak' },
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
        case 'meta': {
          // Unrated brawlers sort last rather than as zero, so "no data" never
          // reads as "worst in the game".
          const sa = meta[a.id]?.metaScore ?? -1;
          const sb = meta[b.id]?.metaScore ?? -1;
          return sb - sa || b.trophies - a.trophies;
        }
        case 'peak':
          return peakGap(b) - peakGap(a) || b.trophies - a.trophies;
        default:
          return b.trophies - a.trophies;
      }
    });
  }, [brawlers, meta, query, sort]);

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
  const gap = peakGap(brawler);
  const tier = meta?.tier;

  return (
    <Link
      href={`/brawlers/${brawler.id}`}
      className="card card-interactive group relative overflow-hidden p-3"
      style={{ borderColor: `color-mix(in srgb, ${accent} 35%, transparent)` }}
      title={
        tier
          ? `${brawler.name}: ${tier} tier on the trophy list, meta score ${meta?.metaScore?.toFixed(1) ?? '?'}`
          : `${brawler.name}: not enough sampled battles to rate`
      }
    >
      <span
        className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: accent }}
      />

      {/* Corner rather than inline: the tile is 96px wide and the chip has to
          not compete with the power badge or the name. */}
      {tier ? (
        <span
          className="absolute right-2 top-2 z-10 grid size-5 place-items-center rounded text-[0.625rem] font-black"
          style={{
            color: TIER_COLOR[tier],
            background: `color-mix(in srgb, ${TIER_COLOR[tier]} 22%, var(--surface))`,
          }}
        >
          {tier}
        </span>
      ) : null}

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
          <TrophyIcon className="size-3" />
          {formatNumber(brawler.trophies)}
        </span>
        <span className="flex items-center gap-1 tabular-nums text-muted">
          <Star className="size-3" />
          {brawler.rank}
        </span>
      </div>

      {/* Only when it is actually off peak. A "−0" under every maxed brawler
          would be noise on 106 tiles. */}
      <p className="mt-1 text-center text-[11px] tabular-nums text-muted">
        {gap > 0 ? (
          <span title={`Peak ${formatNumber(brawler.highestTrophies)}`}>
            −{formatNumber(gap)} off peak
          </span>
        ) : (
          <span className="text-victory/80">At peak</span>
        )}
      </p>

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
