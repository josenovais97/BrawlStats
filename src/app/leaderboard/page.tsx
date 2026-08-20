import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Shield } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { CosmeticsBoard } from '@/components/leaderboard/cosmetics-board';
import { RankedBoard } from '@/components/leaderboard/ranked-board';
import {
  LeaderboardControls,
  type LeaderboardBoard,
} from '@/components/leaderboard/leaderboard-controls';
import { TrophyGains } from '@/components/leaderboard/trophy-gains';
import { ErrorState } from '@/components/ui/error-state';
import { SectionHeading } from '@/components/ui/section-heading';
import { PlayersIcon, TrophyIcon } from '@/components/game-icons';
import { clubBadgeUrl, playerIconUrl } from '@/lib/brawlapi';
import { getClubRankings, getPlayerRankings } from '@/lib/bs-api';
import { toApiError } from '@/lib/errors';
import { formatNumber, nameColorToCss } from '@/lib/format';
import { isSupportedRegion, regionName } from '@/lib/regions';
import { normalizeTag } from '@/lib/tags';

export const metadata: Metadata = {
  // Self-canonical, which is doing real work here: region and board type
  // are query parameters, so the same page is reachable at well over a
  // hundred URLs. Without this every one of them competes as a separate
  // result.
  alternates: { canonical: '/leaderboard' },
  title: 'Brawl Stars leaderboard',
  description: 'Top Brawl Stars players and clubs by trophies, filterable by region.',
};

export const revalidate = 120;

interface PageProps {
  searchParams: Promise<{ region?: string; type?: string }>;
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const region =
    params.region && isSupportedRegion(params.region) ? params.region.toLowerCase() : 'global';
  const board: LeaderboardBoard =
    params.type === 'clubs' || params.type === 'cosmetics' || params.type === 'ranked'
      ? params.type
      : 'players';

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow flex items-center gap-2 text-accent">
          <TrophyIcon className="size-4" />
          {board === 'cosmetics' || board === 'ranked' ? 'Our own data' : 'Official rankings'}
        </p>
        <h1 className="display mt-2.5 text-3xl uppercase sm:text-4xl">Leaderboard</h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted">
          {board === 'cosmetics'
            ? 'What the sampled player pool is wearing. Built from our own daily samples, not from the game API.'
            : board === 'ranked'
              ? 'Top players by Ranked elo. The game API has no Ranked leaderboard, so this one is ours.'
              : `The official top 100 ${board} by trophies in ${regionName(region)}, straight from the game API.`}
        </p>
      </header>

      <LeaderboardControls region={region} board={board} />

      {/*
        Above the board on purpose. It is the one thing here that is ours rather
        than a mirror of the game API, and below a hundred rows nobody would
        ever reach it. Streamed separately so our aggregate never delays the
        live board. Players only: clubs have no per-member trophy history.
      */}
      {board === 'players' ? (
        <Suspense fallback={null}>
          <TrophyGains />
        </Suspense>
      ) : null}

      {board === 'players' ? <PlayerBoard region={region} /> : null}
      {board === 'clubs' ? <ClubBoard region={region} /> : null}
      {board === 'ranked' ? (
        <Suspense fallback={null}>
          <RankedBoard />
        </Suspense>
      ) : null}
      {board === 'cosmetics' ? (
        <Suspense fallback={null}>
          <CosmeticsBoard />
        </Suspense>
      ) : null}
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
    <section aria-labelledby="player-board">
      {/* Headed explicitly, and named for its population. Unheaded, it ran
          straight on from the trophy-gains list above and read as more of the
          same ranking. Which it is not: that list is our sampled pool, this
          one is the game's own top 100. */}
      <div id="player-board">
        <SectionHeading
          title={`Top players in ${regionName(region)}`}
          subtitle="By total trophies, from the game API's own ranking."
          aside={`${items.length} shown`}
        />
      </div>
      <ol className="space-y-2">
        {items.map((player) => (
          <li key={player.tag}>
            <Link
              href={`/player/${normalizeTag(player.tag)}`}
              className="card card-interactive flex items-center gap-3 p-3"
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
                <TrophyIcon className="size-4" />
                {formatNumber(player.trophies)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
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
    <section aria-labelledby="club-board">
      <div id="club-board">
        <SectionHeading
          title={`Top clubs in ${regionName(region)}`}
          subtitle="By combined member trophies, from the game API's own ranking."
          aside={`${items.length} shown`}
        />
      </div>
      <ol className="space-y-2">
        {items.map((club) => (
          <li key={club.tag}>
            <Link
              href={`/club/${normalizeTag(club.tag)}`}
              className="card card-interactive flex items-center gap-3 p-3"
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
                  <PlayersIcon className="size-3.5" />
                  {club.memberCount}/30 members
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 font-bold tabular-nums text-brand">
                <TrophyIcon className="size-4" />
                {formatNumber(club.trophies)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
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
