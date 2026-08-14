import type { Metadata } from 'next';
import { Shield, Trophy, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { LeaderboardControls } from '@/components/leaderboard/leaderboard-controls';
import { ErrorState } from '@/components/ui/error-state';
import { clubBadgeUrl, playerIconUrl } from '@/lib/brawlapi';
import { getClubRankings, getPlayerRankings } from '@/lib/bs-api';
import { toApiError } from '@/lib/errors';
import { formatNumber, nameColorToCss } from '@/lib/format';
import { isSupportedRegion, regionName } from '@/lib/regions';
import { normalizeTag } from '@/lib/tags';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'Top Brawl Stars players and clubs by trophies, filterable by region.',
};

export const revalidate = 120;

type Board = 'players' | 'clubs';

interface PageProps {
  searchParams: Promise<{ region?: string; type?: string }>;
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const region =
    params.region && isSupportedRegion(params.region) ? params.region.toLowerCase() : 'global';
  const board: Board = params.type === 'clubs' ? 'clubs' : 'players';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Leaderboard</h1>
        <p className="mt-2 text-muted">
          Top {board} by trophies in {regionName(region)}.
        </p>
      </header>

      <LeaderboardControls region={region} board={board} />

      {board === 'players' ? (
        <PlayerBoard region={region} />
      ) : (
        <ClubBoard region={region} />
      )}
    </div>
  );
}

async function PlayerBoard({ region }: { region: string }) {
  let items;
  try {
    ({ items } = await getPlayerRankings(region, 100));
  } catch (err) {
    return <ErrorState code={toApiError(err).code} backHref="/leaderboard" backLabel="Reset" />;
  }

  if (items.length === 0) {
    return <EmptyRegion region={region} />;
  }

  return (
    <ol className="space-y-2">
        {items.map((player) => (
          <li key={player.tag}>
            <Link
              href={`/player/${normalizeTag(player.tag)}`}
              className="card flex items-center gap-3 p-3 transition-colors hover:border-brand/40"
            >
              <RankBadge rank={player.rank} />
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
                <p className="truncate text-xs text-muted">
                  {player.club?.name ?? 'No club'}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 font-bold tabular-nums text-brand">
                <Trophy className="size-4" />
                {formatNumber(player.trophies)}
              </span>
            </Link>
        </li>
      ))}
    </ol>
  );
}

async function ClubBoard({ region }: { region: string }) {
  let items;
  try {
    ({ items } = await getClubRankings(region, 100));
  } catch (err) {
    return <ErrorState code={toApiError(err).code} backHref="/leaderboard" backLabel="Reset" />;
  }

  if (items.length === 0) {
    return <EmptyRegion region={region} />;
  }

  return (
    <ol className="space-y-2">
      {items.map((club) => (
          <li key={club.tag}>
            <Link
              href={`/club/${normalizeTag(club.tag)}`}
              className="card flex items-center gap-3 p-3 transition-colors hover:border-brand/40"
            >
              <RankBadge rank={club.rank} />
              <Image
                src={clubBadgeUrl(club.badgeId)}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-lg bg-surface-2 p-0.5"
                unoptimized
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{club.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted">
                  <Users className="size-3" />
                  {club.memberCount}/30 members
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 font-bold tabular-nums text-brand">
                <Trophy className="size-4" />
                {formatNumber(club.trophies)}
              </span>
            </Link>
        </li>
      ))}
    </ol>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1 ? '#ffc53d' : rank === 2 ? '#c9d3e8' : rank === 3 ? '#d08c4a' : null;

  return (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-lg text-sm font-black tabular-nums"
      style={
        medal
          ? { background: `color-mix(in srgb, ${medal} 22%, transparent)`, color: medal }
          : { color: 'var(--muted)' }
      }
    >
      {rank}
    </span>
  );
}

function EmptyRegion({ region }: { region: string }) {
  return (
    <div className="card p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-2 text-muted">
        <Shield className="size-6" />
      </span>
      <p className="mt-3 font-semibold">No ranking data for {regionName(region)}</p>
      <p className="mt-1 text-sm text-muted">
        Not every country has a populated leaderboard. Try Global or a larger region.
      </p>
    </div>
  );
}
