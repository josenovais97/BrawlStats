import { Globe } from 'lucide-react';

import { LeaderboardIcon } from '@/components/game-icons';
import Image from 'next/image';
import Link from 'next/link';

import { Disclosure } from '@/components/ui/disclosure';
import { SectionHeading } from '@/components/ui/section-heading';
import { brawlerPath } from '@/lib/slugs';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber } from '@/lib/format';
import type { BrawlerPlacement } from '@/types/stats';

interface Props {
  placements: BrawlerPlacement[];
  /** brawlerId -> artwork URL. */
  iconFor: (id: number) => string | undefined;
}

/**
 * Placements shown before the rest fold away.
 *
 * Eight fits two rows on a phone and one on a desktop, which is the point:
 * the section should read as a highlight, not as an inventory.
 */
const SHOWN = 8;

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
  // Already ordered best-first by the query.
  const shown = placements.slice(0, SHOWN);
  const rest = placements.slice(SHOWN);

  return (
    <section>
      <SectionHeading
        icon={<LeaderboardIcon className="size-6" />}
        title="World ranked"
        aside={
          placements.length === 1
            ? 'On 1 global brawler leaderboard'
            : `On ${placements.length} global brawler leaderboards`
        }
      />

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

      {/*
        Capped, because the very players this section exists for are the ones
        it breaks on: a top-200 regular holds dozens of placements — 61 on the
        profile that prompted this — and an uncapped wrap of chips pushed
        Progression and everything under it most of a screen down. The best
        ones are the point; the rest are a list you open if you want it.
      */}
      <ul className="flex flex-wrap gap-2">
        {shown.map((placement) => (
          <li key={placement.brawlerId}>
            <Chip placement={placement} iconFor={iconFor} />
          </li>
        ))}
      </ul>

      {rest.length > 0 ? (
        <Disclosure
          tone="bare"
          className="mt-1"
          summary={`Show all ${placements.length} placements`}
        >
          <ul className="flex flex-wrap gap-2">
            {rest.map((placement) => (
              <li key={placement.brawlerId}>
                <Chip placement={placement} iconFor={iconFor} />
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </section>
  );
}

/** One placement: rank band colour, portrait, brawler. */
function Chip({
  placement,
  iconFor,
}: {
  placement: BrawlerPlacement;
  iconFor: (id: number) => string | undefined;
}) {
  const { color } = band(placement.rank);
  return (
    <Link
      href={brawlerPath(placement.brawlerId, placement.brawlerName)}
      className="card card-interactive flex items-center gap-2 py-1.5 pl-1.5 pr-3"
      title={`#${placement.rank} in the world on ${placement.brawlerName}`}
    >
      <Image
        src={iconFor(placement.brawlerId) ?? brawlerIconUrl(placement.brawlerId)}
        alt=""
        width={28}
        height={28}
        className="size-7 shrink-0"
        loading="lazy"
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
}
