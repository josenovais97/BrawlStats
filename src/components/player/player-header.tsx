import { Shield, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { FavoriteButton } from '@/components/favorite-button';
import { TrophyIcon } from '@/components/game-icons';
import { playerIconUrl, prestigeIconUrl } from '@/lib/brawlapi';
import { formatNumber, nameColorToCss } from '@/lib/format';
import { normalizeTag } from '@/lib/tags';
import type { BSPlayer } from '@/types/brawlstars';

export function PlayerHeader({ player }: { player: BSPlayer }) {
  const nameColor = nameColorToCss(player.nameColor);
  const prestige = prestigeIconUrl(player.totalPrestigeLevel);

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

      <div className="relative flex flex-wrap items-center gap-5 p-6 sm:p-7">
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
            className="relative size-[88px] rounded-2xl bg-surface-2 ring-1 ring-border-strong"
            priority
            unoptimized
          />
        </div>

        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-3xl font-black tracking-tight sm:text-4xl"
            style={{ color: nameColor }}
          >
            {player.name}
          </h1>

          <p className="mt-1 font-mono text-sm text-muted">{player.tag}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 font-medium">
              <Sparkles className="size-3.5 text-brand" />
              Level {player.expLevel}
            </span>

            {prestige && player.totalPrestigeLevel ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 font-medium">
                <Image
                  src={prestige}
                  alt=""
                  width={16}
                  height={16}
                  className="size-4 object-contain"
                  unoptimized
                />
                Prestige {formatNumber(player.totalPrestigeLevel)}
              </span>
            ) : null}

            {player.club?.tag ? (
              <Link
                href={`/club/${normalizeTag(player.club.tag)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 font-medium transition-colors hover:border-accent/60 hover:text-foreground"
              >
                <Shield className="size-3.5 text-accent" />
                {player.club.name}
              </Link>
            ) : (
              <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-muted">
                No club
              </span>
            )}

            {player.isQualifiedFromChampionshipChallenge ? (
              <span className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 font-medium text-brand">
                Championship qualified
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2.5">
          <div className="flex flex-col items-end gap-1 rounded-2xl border border-border bg-surface-2/60 px-5 py-4">
            <span className="flex items-center gap-2 text-3xl font-black tabular-nums text-brand sm:text-4xl">
              <TrophyIcon className="size-7" />
              {formatNumber(player.trophies)}
            </span>
            <span className="text-xs text-muted">
              Peak {formatNumber(player.highestTrophies)}
            </span>
          </div>
          <FavoriteButton
            kind="player"
            tag={normalizeTag(player.tag)}
            name={player.name}
          />
        </div>
      </div>
    </header>
  );
}
