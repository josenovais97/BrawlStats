import { Suspense } from 'react';
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
import { LeaderboardIcon, PlayersIcon, TrophyIcon } from '@/components/game-icons';
import { clubBadgeUrl, playerIconUrl } from '@/lib/brawlapi';
import { getClubRankings, getPlayerRankings } from '@/lib/bs-api';
import { toApiError } from '@/lib/errors';
import { formatNumber, nameColorToCss } from '@/lib/format';
import { regionName } from '@/lib/regions';
import { normalizeTag } from '@/lib/tags';
import { CLUB_LINK_REL, playerLinkRel } from '@/lib/link-rel';

/**
 * Must match `revalidate` on the three leaderboard routes.
 *
 * Not decorative: Next takes a route's revalidate from the shortest-lived
 * fetch inside it, so leaving these calls on the 120s default pinned the pages
 * to two minutes no matter what they exported. The build output is the check —
 * the route table prints the effective value, not the declared one.
 */
const RANKING_REVALIDATE = 900;

/**
 * The leaderboard, for one already-resolved board and region.
 *
 * Both used to be read here from `searchParams`, which is what kept this page
 * — identical for everyone looking at the same board — re-rendering and
 * re-fetching the game API on every request. `resolveLeaderboardRoute` reads
 * them from the path instead, so each board is one cacheable page.
 */
export async function LeaderboardView({
  board,
  region,
}: {
  board: LeaderboardBoard;
  region: string;
}) {
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

      {/*
        Below the board now. It sat above it as the one thing here that is ours
        rather than the game API's -- but it is a different population, and on
        a phone it put the official top 100, the answer the page is named for,
        a full screen down. The board's podium now opens the page. Streamed
        separately so our aggregate never delays the live board.
      */}
      {board === 'players' ? (
        <Suspense fallback={null}>
          <TrophyGains />
        </Suspense>
      ) : null}
    </div>
  );
}

async function PlayerBoard({ region }: { region: string }) {
  let items;
  try {
    ({ items } = await getPlayerRankings(region, 100, RANKING_REVALIDATE));
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
      {/* The top three as a podium, first place in the middle and raised:
          the world's best players were three rows like any other. */}
      {items.length >= 3 ? (
        <ol className="mb-4 grid grid-cols-3 items-end gap-2 sm:gap-4" aria-label="Top three players">
          {[1, 0, 2].map((i) => {
            const player = items[i];
            const first = i === 0;
            return (
              <li key={player.tag} className={first ? '' : 'pt-6 sm:pt-8'}>
                <Link
                  href={`/player/${normalizeTag(player.tag)}`}
                  rel={playerLinkRel(normalizeTag(player.tag))}
                  prefetch={false}
                  className="card card-interactive relative flex flex-col items-center px-2 pb-3 pt-4 text-center sm:px-3"
                  style={
                    first
                      ? { background: 'linear-gradient(170deg, color-mix(in srgb, var(--brand) 22%, transparent), var(--surface) 70%)' }
                      : undefined
                  }
                >
                  <span
                    className={`display absolute left-2 top-2 rounded-md px-2 py-0.5 text-sm ${
                      first ? 'bg-brand text-brand-ink' : 'bg-background/70 text-foreground'
                    }`}
                  >
                    #{player.rank}
                  </span>
                  <Image
                    src={playerIconUrl(player.icon?.id)}
                    alt=""
                    width={96}
                    height={96}
                    className={`rounded-2xl border-2 bg-surface-2 ${
                      first ? 'size-20 border-brand sm:size-24' : 'size-16 border-border sm:size-20'
                    }`}
                    unoptimized
                  />
                  <p
                    className="mt-2 w-full truncate text-sm font-bold sm:text-base"
                    style={{ color: nameColorToCss(player.nameColor) }}
                  >
                    {player.name}
                  </p>
                  <p className="w-full truncate text-[11px] text-muted sm:text-xs">
                    {player.club?.name ?? 'No club'}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-sm font-black tabular-nums text-brand sm:text-base">
                    <TrophyIcon className="size-4" />
                    {formatNumber(player.trophies)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : null}
      <ol className="space-y-2">
        {(items.length >= 3 ? items.slice(3) : items).map((player) => (
          <li key={player.tag}>
            <Link
              href={`/player/${normalizeTag(player.tag)}`}
              rel={playerLinkRel(normalizeTag(player.tag))}
                prefetch={false}
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
    ({ items } = await getClubRankings(region, 100, RANKING_REVALIDATE));
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
              rel={CLUB_LINK_REL}
                prefetch={false}
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
        <LeaderboardIcon className="size-6" />
      </span>
      <p className="mt-3 font-semibold">No ranking data for {regionName(region)}</p>
      <p className="mt-1 text-sm text-muted">
        Not every country has a populated leaderboard. Try Global or a larger region.
      </p>
    </div>
  );
}
