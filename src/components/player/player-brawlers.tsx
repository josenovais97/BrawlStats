'use client';

import { ArrowUpDown, Search, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  BuffieIcon,
  GadgetIcon,
  GearIcon,
  HyperchargeIcon,
  StarPowerIcon,
  TrophyIcon,
  WinStreakIcon,
} from '@/components/game-icons';
import { brawlerPath } from '@/lib/slugs';
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
  /**
   * Full-body art: the equipped skin when the wiki has it, else the model.
   * Resolved on the server and streamed in; absent on the first paint, when
   * the tile draws the portrait instead.
   */
  artUrl?: string;
}

interface PlayerBrawlersProps {
  brawlers: BSPlayerBrawler[];
  meta: Record<string, BrawlerMetaLite>;
}

type SortKey = 'trophies' | 'meta' | 'streak' | 'prestige' | 'peak' | 'rank' | 'power' | 'name';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'trophies', label: 'Trophies' },
  // The reason the tier list exists, applied to the roster: "which of mine are
  // actually good right now".
  { key: 'meta', label: 'Meta' },
  // Sorts by how far below their own peak each brawler sits, which is where a
  // losing streak or a fresh reset shows up.
  { key: 'peak', label: 'Off peak' },
  // Both were in the payload and in our types from the start and had never
  // been rendered anywhere. A 233-game streak is the most impressive number on
  // some accounts.
  { key: 'streak', label: 'Win streak' },
  { key: 'prestige', label: 'Prestige' },
  { key: 'rank', label: 'Rank' },
  { key: 'power', label: 'Power' },
  { key: 'name', label: 'Name' },
];

/**
 * How many tiles a first look is worth.
 *
 * A full roster is 107 tiles and every one of them was in the document at
 * load, on a page that was already the heaviest on the site. Two rows at the
 * widest layout is enough to show what the sort is doing, and the sort is what
 * makes the first two rows the interesting ones — searching or sorting reaches
 * the rest without ever pressing the button.
 */
const FIRST_LOOK = 24;

export function PlayerBrawlers({ brawlers, meta }: PlayerBrawlersProps) {
  const [sort, setSort] = useState<SortKey>('trophies');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  // A search is already a request for a subset, so it is never capped again.
  const searching = query.trim().length > 0;

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
        case 'streak':
          return (b.maxWinStreak ?? 0) - (a.maxWinStreak ?? 0) || b.trophies - a.trophies;
        case 'prestige':
          return (b.prestigeLevel ?? 0) - (a.prestigeLevel ?? 0) || b.trophies - a.trophies;
        default:
          return b.trophies - a.trophies;
      }
    });
  }, [brawlers, meta, query, sort]);

  const capped = !searching && !showAll && visible.length > FIRST_LOOK;
  const shown = capped ? visible.slice(0, FIRST_LOOK) : visible;
  const hidden = visible.length - shown.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {shown.map((brawler) => (
              <BrawlerTile key={brawler.id} brawler={brawler} meta={meta[brawler.id]} />
            ))}
          </div>

          {hidden > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="min-h-11 w-full rounded-xl border border-border bg-surface-2/60 text-sm font-semibold text-muted transition-colors hover:border-brand/50 hover:text-foreground"
            >
              Show {hidden} more {hidden === 1 ? 'brawler' : 'brawlers'}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

/** A live streak worth a flame on the tile; matches the Overview's "On fire". */
const HOT_STREAK = 3;

function BrawlerTile({
  brawler,
  meta,
}: {
  brawler: BSPlayerBrawler;
  meta?: BrawlerMetaLite;
}) {
  const accent = meta?.rarityColor ?? '#8b95b8';
  const gap = peakGap(brawler);
  const tier = meta?.tier;
  const prestige = brawler.prestigeLevel ?? 0;
  const best = brawler.maxWinStreak ?? 0;
  const live = brawler.currentWinStreak ?? 0;
  const portrait = meta?.imageUrl ?? brawlerIconUrl(brawler.id);
  /*
   * The model URL is built from the id and not every brawler has one yet, so
   * a 404 falls back to the portrait here rather than costing a HEAD probe
   * per tile on the server -- a hundred of them on a full roster.
   */
  const [src, setSrc] = useState(meta?.artUrl ?? portrait);
  const full = src !== portrait;

  const kit: { key: string; node: React.ReactNode; n: number; label: string }[] = [
    { key: 'sp', node: <StarPowerIcon className="size-4" />, n: brawler.starPowers.length, label: 'Star powers' },
    { key: 'gd', node: <GadgetIcon className="size-4" />, n: brawler.gadgets.length, label: 'Gadgets' },
    { key: 'gr', node: <GearIcon className="size-4" />, n: brawler.gears?.length ?? 0, label: 'Gears' },
    { key: 'hc', node: <HyperchargeIcon className="size-4" />, n: brawler.hyperCharges?.length ?? 0, label: 'Hypercharge' },
    {
      key: 'bf',
      node: <BuffieIcon className="size-4" />,
      n: Object.values(brawler.buffies ?? {}).filter(Boolean).length,
      label: 'Buffies',
    },
  ].filter((k) => k.n > 0);

  return (
    <Link
      href={brawlerPath(brawler.id, brawler.name)}
      prefetch={false}
      className="group relative flex flex-col overflow-hidden rounded-2xl border transition-colors hover:border-brand/60"
      style={{
        borderColor: `color-mix(in srgb, ${accent} 40%, var(--border))`,
        background: `linear-gradient(165deg, color-mix(in srgb, ${accent} 24%, transparent), var(--surface) 62%)`,
      }}
      title={
        tier
          ? `${brawler.name}: ${tier} tier on the trophy list, meta score ${meta?.metaScore?.toFixed(1) ?? '?'}`
          : `${brawler.name}: not enough sampled battles to rate`
      }
    >
      {/* Corner chips, opposite each other: prestige left, tier right. */}
      {prestige > 0 ? (
        <span
          className="absolute left-2 top-2 z-10 rounded-md bg-background/70 px-1.5 py-0.5 text-[10px] font-black text-accent backdrop-blur"
          title={`Prestige ${prestige}`}
        >
          P{prestige}
        </span>
      ) : null}
      {tier ? (
        <span
          className="absolute right-2 top-2 z-10 grid size-6 place-items-center rounded-md text-xs font-black backdrop-blur"
          style={{
            color: TIER_COLOR[tier],
            background: `color-mix(in srgb, ${TIER_COLOR[tier]} 22%, var(--surface))`,
          }}
        >
          {tier}
        </span>
      ) : null}

      {/* The figure, standing on a soft glow in its rarity colour. */}
      <div className="relative flex h-32 items-end justify-center pt-5 sm:h-36">
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1 left-1/2 size-24 -translate-x-1/2 rounded-full opacity-35 blur-2xl"
          style={{ background: accent }}
        />
        <Image
          src={src}
          alt={brawler.name}
          width={128}
          height={128}
          onError={() => setSrc(portrait)}
          className={`relative w-auto object-contain transition-transform group-hover:scale-105 ${
            full
              ? 'h-28 drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)] sm:h-32'
              : 'mb-2 h-20 rounded-xl sm:h-24'
          }`}
          loading="lazy"
          unoptimized
        />
        <span
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rounded-md px-2 py-0.5 text-xs font-black text-[#1a1200] shadow"
          style={{ background: 'var(--brand)' }}
          title={`Power ${brawler.power}`}
        >
          {brawler.power}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center gap-1 px-2.5 pb-3 pt-4 text-center">
        <p className="display w-full truncate text-sm uppercase">{brawler.name.toLowerCase()}</p>

        <p className="flex items-center gap-2.5 text-xs">
          <span className="flex items-center gap-1 font-black tabular-nums text-brand">
            <TrophyIcon className="size-3.5" />
            {formatNumber(brawler.trophies)}
          </span>
          <span className="flex items-center gap-1 tabular-nums text-muted" title={`Rank ${brawler.rank}`}>
            <Star className="size-3" />
            {brawler.rank}
          </span>
        </p>

        {/* Only when it is actually off peak; "−0" on every maxed brawler
            would be noise on a hundred tiles. */}
        <p className="text-[11px] tabular-nums text-muted">
          {gap > 0 ? (
            <span title={`Peak ${formatNumber(brawler.highestTrophies)}`}>
              −{formatNumber(gap)} off peak
            </span>
          ) : (
            <span className="text-victory/80">At peak</span>
          )}
        </p>

        {/* The live streak leads when it is hot -- the only number on the tile
            that is true right now rather than ever. */}
        {live >= HOT_STREAK ? (
          <p
            className="flex items-center gap-1 rounded-full bg-victory/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-victory"
            title={`On ${live} in a row; best ${best}`}
          >
            <WinStreakIcon className="size-3.5" />
            {live} in a row
          </p>
        ) : best > 0 ? (
          <p
            className="flex items-center gap-1 text-[11px] tabular-nums text-muted"
            title={`Best win streak ${best}`}
          >
            <WinStreakIcon className="size-3.5" />
            best {best}
          </p>
        ) : null}

        {/* The kit as the game's own icons with a count, in place of
            "2 SP · 2 GD · 2 GR" -- read by shape, like the game reads it. */}
        {kit.length ? (
          <ul className="mt-auto flex flex-wrap items-center justify-center gap-1 pt-1.5">
            {kit.map((k) => (
              <li
                key={k.key}
                className="flex items-center gap-0.5 rounded-md bg-background/50 px-1 py-0.5 text-[10px] font-bold tabular-nums"
                title={`${k.label}: ${k.n}`}
              >
                {k.node}
                {k.n > 1 ? k.n : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Link>
  );
}
