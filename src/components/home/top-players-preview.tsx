import Image from 'next/image';
import Link from 'next/link';

import { TrophyIcon } from '@/components/game-icons';
import { getPlayerRankings } from '@/lib/bs-api';
import { playerIconUrl } from '@/lib/brawlapi';
import { formatNumber, nameColorToCss } from '@/lib/format';
import { normalizeTag } from '@/lib/tags';

/** Podium colours for the first three rows. Everything below is neutral. */
const PODIUM = ['#ffc53d', '#c9d3ee', '#e08a4a'];

/**
 * Homepage teaser. A failure here must not take down the landing page, so any
 * error degrades to a quiet inline notice rather than an error boundary.
 */
export async function TopPlayersPreview({ limit = 5 }: { limit?: number } = {}) {
  let players;
  try {
    players = (await getPlayerRankings('global', limit)).items;
  } catch {
    return (
      <div className="card p-6 text-sm text-muted">
        The global leaderboard is unavailable right now. Player and club search still
        work.
      </div>
    );
  }

  return (
    <ol className="card divide-y divide-border overflow-hidden">
      {players.map((player, index) => {
        const tag = normalizeTag(player.tag);
        const podium = PODIUM[index];

        return (
          <li key={player.tag}>
            <Link
              href={`/player/${tag}`}
                prefetch={false}
              className="row-interactive flex items-center gap-3 p-3 sm:gap-4 sm:p-3.5"
            >
              <span
                className="grid size-7 shrink-0 place-items-center rounded-lg text-sm font-black tabular-nums sm:size-8"
                style={
                  podium
                    ? {
                        background: `color-mix(in srgb, ${podium} 18%, transparent)`,
                        color: podium,
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${podium} 35%, transparent)`,
                      }
                    : { color: 'var(--muted)' }
                }
              >
                {player.rank}
              </span>

              <Image
                src={playerIconUrl(player.icon?.id)}
                alt=""
                width={44}
                height={44}
                className="size-10 shrink-0 rounded-lg bg-surface-2 sm:size-11"
                loading="lazy"
                unoptimized
              />

              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-semibold leading-tight"
                  style={{ color: nameColorToCss(player.nameColor) }}
                >
                  {player.name}
                </p>
                <p className="mt-1 truncate text-xs text-muted">
                  {player.club?.name ?? 'No club'}
                </p>
              </div>

              <span className="flex shrink-0 items-center gap-1.5 text-brand">
                <TrophyIcon className="size-4" />
                <span className="display text-base leading-none tabular-nums sm:text-lg">
                  {formatNumber(player.trophies)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
