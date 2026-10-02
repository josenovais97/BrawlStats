import Image from 'next/image';
import Link from 'next/link';

import { FavoriteButton } from '@/components/favorite-button';
import {
  BattlesIcon,
  ClubIcon,
  ExperienceIcon,
  PrestigeIcon,
  TrophyIcon,
} from '@/components/game-icons';
import { playerIconUrl, rankedLeagueIconUrl, rankedTierIconUrl } from '@/lib/brawlapi';
import { formatNumber, nameColorToCss } from '@/lib/format';
import { ShareButton } from '@/components/player/share-button';
import { normalizeTag } from '@/lib/tags';
import type { BSPlayer } from '@/types/brawlstars';

export function PlayerHeader({
  player,
  lastOnline,
}: {
  player: BSPlayer;
  /** Streamed in separately; derived from the battle log, not the player payload. */
  lastOnline?: React.ReactNode;
}) {
  const nameColor = nameColorToCss(player.nameColor);

  /*
   * The hero said who the account was and how many trophies it had, and
   * nothing at all about Ranked -- which on a competitive profile is half the
   * identity. A reader had to scroll past the tabs to find out that this
   * Silver I account peaked at Mythic I.
   *
   * Real tier art, with the league badge as the fallback the ranked section
   * already uses: `rankedRank` is the numbered tier and is absent on accounts
   * that only ever reached a league.
   */
  const rankedArt =
    rankedTierIconUrl(player.rankedRank) ?? rankedLeagueIconUrl(player.rankedRankName);
  const peakArt =
    rankedTierIconUrl(player.highestAllTimeRankedRank) ??
    rankedLeagueIconUrl(player.highestAllTimeRankedRankName);
  const hasRanked = Boolean(player.rankedRankName || player.highestAllTimeRankedRankName);

  return (
    <header className="card card-glow relative overflow-hidden">
      {/*
       * A wash tinted by the player's own name colour, so two profiles never
       * look identical and the header feels bespoke rather than templated.
       */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-[0.18]"
        style={{
          background: `radial-gradient(40rem 12rem at 18% 0%, ${nameColor}, transparent 70%)`,
        }}
      />

      {/*
       * Three rows that collapse into two from `sm` up, rather than three
       * columns that squeeze.
       *
       * The previous layout was a wrapping row whose middle column was
       * `flex-1 min-w-0`. That combination cannot wrap: a flex item allowed to
       * shrink to zero never overflows the line, so the browser kept all three
       * columns on one row and squeezed the middle to a sliver — while its own
       * contents (a 4xl heading, and chips that cannot shrink past their
       * padding) carried on at full size and spilled across the trophy card.
       * On a 360px phone that read as a broken page.
       *
       * So identity and trophies each get an explicit basis and are allowed to
       * wrap as whole blocks, and the chips are a full-width row of their own
       * at every width instead of being nested inside a shrinking column.
       */}
      <div className="relative flex flex-wrap items-center gap-x-5 gap-y-4 p-5 sm:p-7">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-4">
          <div className="relative shrink-0">
            <span
              aria-hidden
              className="absolute -inset-1.5 rounded-[1.4rem] opacity-40 blur-md"
              style={{ background: nameColor }}
            />
            <Image
              src={playerIconUrl(player.icon?.id)}
              alt=""
              width={88}
              height={88}
              sizes="(max-width: 640px) 64px, 88px"
              className="relative size-16 rounded-2xl bg-surface-2 ring-1 ring-border-strong sm:size-[88px]"
              priority
              unoptimized
            />
          </div>

          <div className="min-w-0">
            {/* Steps down on a phone: at 4xl a name of average length filled
                the width on its own and left nothing for the avatar. */}
            <h1
              className="display truncate text-2xl uppercase sm:text-4xl lg:text-5xl"
              style={{ color: nameColor }}
            >
              {player.name}
            </h1>
            <p className="mt-1 truncate font-mono text-sm text-muted">{player.tag}</p>
          </div>
        </div>

        {/*
          Always a column.
          
          This used to put the trophy card and the two buttons side by side on
          a phone, which fit while there was one stat block. There are two now
          -- trophies and Ranked -- and three things across 358px pushed Save
          and Share off the right-hand edge, clipped mid-word. The stat pair
          takes its own row and the buttons take theirs.
        */}
        <div className="flex w-full shrink-0 flex-col items-stretch gap-2.5 sm:w-auto">
          {/*
            The two numbers that say how good this account is, side by side:
            what the ladder thinks and what Ranked thinks. Trophies alone was
            half the answer, and on a smurf -- Silver I today, Mythic I at
            peak -- it was the less interesting half.
          */}
          <div className="flex flex-1 items-stretch gap-2.5 sm:flex-none">
            <div className="flex flex-1 flex-col items-end justify-center gap-0.5 rounded-2xl border border-border bg-surface-2/60 px-4 py-3 sm:px-5 sm:py-4">
              <span className="flex items-center gap-2 text-2xl font-black tabular-nums text-brand sm:text-4xl">
                <TrophyIcon className="size-6 sm:size-7" />
                {formatNumber(player.trophies)}
              </span>
              <span className="text-xs text-muted">
                Peak {formatNumber(player.highestTrophies)}
              </span>
            </div>

            {hasRanked ? (
              <div className="flex flex-1 items-center justify-end gap-2.5 rounded-2xl border border-border bg-surface-2/60 px-4 py-3 sm:px-5 sm:py-4">
                {rankedArt ?? peakArt ? (
                  <Image
                    src={(rankedArt ?? peakArt) as string}
                    alt=""
                    width={44}
                    height={44}
                    className="size-9 shrink-0 object-contain sm:size-11"
                    unoptimized
                  />
                ) : null}
                <div className="min-w-0 text-right">
                  <p className="truncate text-base font-black uppercase leading-tight text-accent sm:text-lg">
                    {player.rankedRankName ?? 'Unranked'}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {player.highestAllTimeRankedRankName
                      ? `Peak ${player.highestAllTimeRankedRankName}`
                      : 'No peak on record'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          {/*
            The two profile actions share one row rather than taking a stacked
            slot each. Stacked, they made this card a third taller than the
            identity beside it needs, which left a band of empty space across
            the middle -- the header is a place to read a name and a trophy
            count, not a column of controls.

            Share belongs to the profile rather than to any one section of it.
            It used to sit on the trophy-progress heading, which returns null
            for anyone with fewer than two days of sampled history, so three of
            the four profiles checked on 2026-08-27 had no share button at all.
          */}
          <div className="grid flex-1 grid-cols-2 items-stretch gap-2.5 sm:flex-none">
            <FavoriteButton
              kind="player"
              tag={normalizeTag(player.tag)}
              name={player.name}
            />
            <ShareButton
              title={`${player.name} on BrawlZone`}
              text={`${player.name} (${player.tag}) has ${formatNumber(player.trophies)} trophies on BrawlZone`}
            />
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 font-medium">
            <ExperienceIcon className="size-4" />
            Level {player.expLevel}
          </span>

          {/* The badge is the milestone reached (1, 25, 50, 100, 200), the
              number beside it is the exact total. */}
          {player.totalPrestigeLevel ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 font-medium">
              <PrestigeIcon total={player.totalPrestigeLevel} className="size-4" />
              Prestige {formatNumber(player.totalPrestigeLevel)}
            </span>
          ) : null}

          {/* The card belongs in the chip row rather than as a section of its
              own: it is a link to a different view of this profile, not another
              thing to read here. */}
          <Link
            href={`/wrapped/${normalizeTag(player.tag)}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 font-medium transition-colors hover:border-brand/60 hover:text-foreground"
          >
            <BattlesIcon className="size-4" />
            Recent run
          </Link>

          {player.club?.tag ? (
            <Link
              href={`/club/${normalizeTag(player.club.tag)}`}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 font-medium transition-colors hover:border-accent/60 hover:text-foreground"
            >
              <ClubIcon className="size-4 shrink-0" />
              {/* Club names run long and are player-authored, so this is the
                  one chip that has to be allowed to truncate. */}
              <span className="truncate">{player.club.name}</span>
            </Link>
          ) : (
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-muted">
              No club
            </span>
          )}

          {lastOnline}

          {player.isQualifiedFromChampionshipChallenge ? (
            <span className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 font-medium text-brand">
              Championship qualified
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
