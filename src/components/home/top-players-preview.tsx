import { Trophy } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { getPlayerRankings } from '@/lib/bs-api';
import { playerIconUrl } from '@/lib/brawlapi';
import { formatNumber, nameColorToCss } from '@/lib/format';
import { normalizeTag } from '@/lib/tags';

/**
 * Homepage teaser. A failure here must not take down the landing page, so any
 * error degrades to a quiet inline notice rather than an error boundary.
 */
export async function TopPlayersPreview() {
  let players;
  try {
    players = (await getPlayerRankings('global', 5)).items;
  } catch {
    return (
      <div className="card p-6 text-sm text-muted">
        The global leaderboard is unavailable right now. Player and club search still work.
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {players.map((player) => {
        const tag = normalizeTag(player.tag);
        return (
          <li key={player.tag}>
            <Link
              href={`/player/${tag}`}
              className="card flex items-center gap-4 p-3 transition-colors hover:border-brand/40"
            >
              <span className="w-8 shrink-0 text-center text-lg font-black tabular-nums text-muted">
                {player.rank}
              </span>
              <Image
                src={playerIconUrl(player.icon?.id)}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-lg bg-surface-2"
                unoptimized
              />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-semibold"
                  style={{ color: nameColorToCss(player.nameColor) }}
                >
                  {player.name}
                </p>
                {player.club?.name ? (
                  <p className="truncate text-xs text-muted">{player.club.name}</p>
                ) : null}
              </div>
              <span className="flex shrink-0 items-center gap-1.5 font-bold tabular-nums text-brand">
                <Trophy className="size-4" />
                {formatNumber(player.trophies)}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
