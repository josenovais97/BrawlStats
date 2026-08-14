import { Crown, Medal, TrendingUp, Users } from 'lucide-react';
import Image from 'next/image';

import { TrophyIcon } from '@/components/game-icons';
import { rankedTierIconUrl } from '@/lib/brawlapi';
import { formatNumber, titleCaseLabel } from '@/lib/format';
import type { BSPlayer } from '@/types/brawlstars';
import type { TrophyStanding } from '@/types/stats';

interface Props {
  player: BSPlayer;
  /** Global trophy leaderboard position, when the player is in the top 200. */
  globalRank: number | null;
  standing: TrophyStanding | null;
}

/**
 * Ranked tiers plus where the account sits relative to other players.
 *
 * Rendered only when there is something to say — a player who has never
 * touched ranked and is not on any leaderboard gets nothing rather than a row
 * of dashes.
 */
export function PlayerRanked({ player, globalRank, standing }: Props) {
  const hasRanked = Boolean(player.rankedRankName || player.highestAllTimeRankedRankName);
  if (!hasRanked && globalRank === null && !standing) return null;

  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold tracking-tight">Ranking</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {hasRanked ? (
          <>
            <Cell
              icon={Medal}
              label="Current ranked"
              value={player.rankedRankName ?? 'Unranked'}
              hint={player.rankedElo ? `${formatNumber(player.rankedElo)} elo` : undefined}
              tone="text-accent"
              badgeUrl={rankedTierIconUrl(player.rankedRank)}
            />
            <Cell
              icon={TrendingUp}
              label="Season best"
              value={player.highestSeasonRankedRankName ?? '—'}
              hint={
                player.highestSeasonRankedElo
                  ? `${formatNumber(player.highestSeasonRankedElo)} elo`
                  : undefined
              }
              tone="text-victory"
              badgeUrl={rankedTierIconUrl(player.highestSeasonRankedRank)}
            />
            <Cell
              icon={Crown}
              label="All-time best"
              value={player.highestAllTimeRankedRankName ?? '—'}
              hint={
                player.highestAllTimeRankedElo
                  ? `${formatNumber(player.highestAllTimeRankedElo)} elo`
                  : undefined
              }
              tone="text-brand"
              badgeUrl={rankedTierIconUrl(player.highestAllTimeRankedRank)}
            />
          </>
        ) : null}

        {globalRank !== null ? (
          <Cell
            icon={Medal}
            label="World rank"
            gameIcon={<TrophyIcon className="size-5" />}
            value={`#${globalRank}`}
            hint="Global trophies"
            tone="text-brand"
          />
        ) : null}

        {standing ? (
          <Cell
            icon={Users}
            label="Trophy standing"
            value={`Top ${formatPercentileLabel(standing.percentile)}`}
            hint={`Of ${formatNumber(standing.population)} tracked players`}
            tone="text-accent"
          />
        ) : null}
      </div>
    </section>
  );
}

/**
 * A player above the 99th percentile should read "Top 1%", not "Top 0.4%",
 * which sounds like a rounding artefact. Below 1% we keep one decimal.
 */
function formatPercentileLabel(percentile: number): string {
  const topFraction = (1 - percentile) * 100;
  if (topFraction < 0.1) return '0.1%';
  if (topFraction < 1) return `${topFraction.toFixed(1)}%`;
  return `${Math.round(topFraction)}%`;
}

function Cell({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  badgeUrl,
  gameIcon,
}: {
  icon: typeof Medal;
  label: string;
  value: string;
  hint?: string;
  tone: string;
  /** Real tier artwork from the CDN; preferred over the glyph when present. */
  badgeUrl?: string | null;
  gameIcon?: React.ReactNode;
}) {
  return (
    <div className="card card-glow flex items-center gap-3 p-4">
      <span className={`grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 ${tone}`}>
        {badgeUrl ? (
          <Image
            src={badgeUrl}
            alt=""
            width={32}
            height={32}
            className="size-8 object-contain"
            unoptimized
          />
        ) : (
          gameIcon ?? <Icon className="size-5" />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className="truncate text-lg font-bold">{titleCaseLabel(value)}</p>
        {hint ? <p className="truncate text-xs text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}
