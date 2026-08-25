import Image from 'next/image';
import Link from 'next/link';

import { TrophyIcon } from '@/components/game-icons';
import { playerIconUrl } from '@/lib/brawlapi';
import { getBrawlerRankings } from '@/lib/bs-api';

/**
 * Must match `revalidate` on `/brawlers/[slug]`, the only page that renders
 * this. A route takes its revalidate from the shortest-lived fetch inside it,
 * so at the 120s default this one call pinned all 106 brawler pages — and the
 * ranking call each of them makes — to a two-minute cycle.
 */
const RANKING_REVALIDATE = 21600;
import { formatNumber, nameColorToCss } from '@/lib/format';
import { normalizeTag } from '@/lib/tags';

/** Global top players ranked by trophies on this specific brawler. */
export async function BrawlerLeaderboard({ brawlerId }: { brawlerId: number }) {
  let players;
  try {
    players = (await getBrawlerRankings(brawlerId, 'global', 10, RANKING_REVALIDATE)).items;
  } catch {
    return (
      <p className="card p-6 text-sm text-muted">
        The brawler leaderboard is unavailable right now.
      </p>
    );
  }

  if (players.length === 0) {
    return (
      <p className="card p-6 text-sm text-muted">
        No ranking data for this brawler yet.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {players.map((player) => (
        <li key={player.tag}>
          <Link
            href={`/player/${normalizeTag(player.tag)}`}
                prefetch={false}
            className="card card-interactive flex items-center gap-4 p-3"
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
              <TrophyIcon className="size-4" />
              {formatNumber(player.trophies)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
