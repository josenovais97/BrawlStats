import { Globe } from 'lucide-react';

import { LeaderboardIcon } from '@/components/game-icons';
import Image from 'next/image';
import Link from 'next/link';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber } from '@/lib/format';
import type { BrawlerPlacement } from '@/types/stats';

interface Props {
  placements: BrawlerPlacement[];
  /** brawlerId -> artwork URL. */
  iconFor: (id: number) => string | undefined;
}

/** Colour bands so a top-10 placement reads differently from a top-200 one. */
function band(rank: number): { label: string; color: string } {
  if (rank <= 10) return { label: 'Top 10', color: '#ffc53d' };
  if (rank <= 25) return { label: 'Top 25', color: '#c9d3e8' };
  if (rank <= 50) return { label: 'Top 50', color: '#d08c4a' };
  if (rank <= 100) return { label: 'Top 100', color: '#7c5cff' };
  return { label: 'Top 200', color: '#35d07f' };
}

/**
 * Global brawler-leaderboard placements. Rendered only when the player holds
 * at least one, so ordinary profiles are not padded with an empty section.
 */
export function PlayerPlacements({ placements, iconFor }: Props) {
  if (placements.length === 0) return null;

  const best = placements[0];

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LeaderboardIcon className="size-6" />
          World ranked
        </h2>
        <p className="text-sm text-muted">
          {placements.length === 1
            ? 'On 1 global brawler leaderboard'
            : `On ${placements.length} global brawler leaderboards`}
        </p>
      </div>

      <div
        className="card card-glow mb-3 flex items-center gap-4 p-5"
        style={{ borderColor: `color-mix(in srgb, ${band(best.rank).color} 45%, transparent)` }}
      >
        <Image
          src={iconFor(best.brawlerId) ?? brawlerIconUrl(best.brawlerId)}
          alt=""
          width={64}
          height={64}
          className="size-16 shrink-0"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted">Best world ranking</p>
          <p className="truncate text-xl font-black capitalize">
            #{best.rank} <span className="text-brand">{best.brawlerName.toLowerCase()}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <Globe className="size-3" />
            Global · {formatNumber(best.trophies)} trophies
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
          style={{
            background: `color-mix(in srgb, ${band(best.rank).color} 20%, transparent)`,
            color: band(best.rank).color,
          }}
        >
          {band(best.rank).label}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {placements.map((placement) => {
          const { color } = band(placement.rank);
          return (
            <Link
              key={placement.brawlerId}
              href={`/brawlers/${placement.brawlerId}`}
              className="card card-interactive flex items-center gap-2 py-1.5 pl-1.5 pr-3"
              title={`#${placement.rank} in the world on ${placement.brawlerName}`}
            >
              <Image
                src={iconFor(placement.brawlerId) ?? brawlerIconUrl(placement.brawlerId)}
                alt=""
                width={28}
                height={28}
                className="size-7 shrink-0"
                unoptimized
              />
              <span className="text-sm font-bold tabular-nums" style={{ color }}>
                #{placement.rank}
              </span>
              <span className="text-sm capitalize text-muted">
                {placement.brawlerName.toLowerCase()}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
