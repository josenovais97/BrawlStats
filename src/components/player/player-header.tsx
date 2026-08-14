import { Shield, Trophy } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { playerIconUrl } from '@/lib/brawlapi';
import { formatNumber, nameColorToCss } from '@/lib/format';
import { normalizeTag } from '@/lib/tags';
import type { BSPlayer } from '@/types/brawlstars';

export function PlayerHeader({ player }: { player: BSPlayer }) {
  return (
    <header className="card card-glow p-6">
      <div className="flex flex-wrap items-center gap-5">
        <Image
          src={playerIconUrl(player.icon?.id)}
          alt=""
          width={80}
          height={80}
          className="size-20 shrink-0 rounded-2xl bg-surface-2"
          priority
          unoptimized
        />

        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-3xl font-black tracking-tight"
            style={{ color: nameColorToCss(player.nameColor) }}
          >
            {player.name}
          </h1>
          <p className="mt-1 font-mono text-sm text-muted">{player.tag}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-surface-2 px-3 py-1 font-medium">
              Level {player.expLevel}
            </span>
            {player.club ? (
              <Link
                href={`/club/${normalizeTag(player.club.tag)}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 font-medium transition-colors hover:bg-accent/20 hover:text-foreground"
              >
                <Shield className="size-3.5 text-accent" />
                {player.club.name}
              </Link>
            ) : (
              <span className="rounded-full bg-surface-2 px-3 py-1 text-muted">No club</span>
            )}
            {player.isQualifiedFromChampionshipChallenge ? (
              <span className="rounded-full bg-brand/15 px-3 py-1 font-medium text-brand">
                Championship qualified
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-2 text-3xl font-black tabular-nums text-brand">
            <Trophy className="size-7" />
            {formatNumber(player.trophies)}
          </span>
          <span className="text-xs text-muted">
            Peak {formatNumber(player.highestTrophies)}
          </span>
        </div>
      </div>
    </header>
  );
}
