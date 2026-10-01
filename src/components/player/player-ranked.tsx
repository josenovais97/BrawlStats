import { TrendingUp } from 'lucide-react';
import Image from 'next/image';

import { CrownIcon, PlayersIcon, RankedIcon, TrophyIcon } from '@/components/game-icons';
import { Panel } from '@/components/ui/panel';
import { rankedLeagueIconUrl, rankedTierIconUrl } from '@/lib/brawlapi';
import { formatNumber, titleCaseLabel } from '@/lib/format';
import type { BSPlayer } from '@/types/brawlstars';
import type { RankedEloStanding } from '@/lib/stats';
import type { TrophyStanding } from '@/types/stats';

interface Props {
  player: BSPlayer;
  /**
   * Global trophy leaderboard position, when the player is in the top 200.
   * Optional because the board is streamed in: the fallback renders this
   * section without it, so the rest of the ranking appears immediately and the
   * rank fills in when the board resolves.
   */
  globalRank?: number | null;
  standing: TrophyStanding | null;
  /**
   * Where this account's Elo sits on the Ranked ladder.
   *
   * The game publishes no Ranked leaderboard and no rank distribution, so this
   * is a number the player cannot get anywhere else — including from the game
   * itself. See `getRankedLadder` for the whole ladder.
   */
  rankedStanding?: RankedEloStanding | null;
}

/**
 * Ranked tiers plus where the account sits relative to other players.
 *
 * Rendered only when there is something to say — a player who has never
 * touched ranked and is not on any leaderboard gets nothing rather than a row
 * of dashes.
 */
export function PlayerRanked({
  player,
  globalRank = null,
  standing,
  rankedStanding = null,
}: Props) {
  const hasRanked = Boolean(player.rankedRankName || player.highestAllTimeRankedRankName);
  if (!hasRanked && globalRank === null && !standing) return null;

  return (
    <Panel title="Ranking" aside="Where the game puts them" bodyClassName="">
      {/*
        One panel of rows, not a grid of five small cards.
        
        Each of these was its own bordered box with an icon tile, which at four
        across read as five unrelated facts rather than one standing — and in
        the two-column layout this now sits in, a four-column grid of cards
        inside a half-width column is unreadable at any size. Rows divide
        cleanly at one column, carry the tier artwork larger, and put the elo
        on the same line as the tier it belongs to.
      */}
      <div className="divide-y divide-border/70">
        {hasRanked ? (
          <>
            <Cell
              gameIcon={<RankedIcon className="size-6" />}
              label="Current ranked"
              value={player.rankedRankName ?? 'Unranked'}
              hint={player.rankedElo ? `${formatNumber(player.rankedElo)} elo` : undefined}
              tone="text-accent"
              badgeUrl={
                rankedTierIconUrl(player.rankedRank) ??
                rankedLeagueIconUrl(player.rankedRankName)
              }
            />
            <Cell
              icon={TrendingUp}
              label="Season best"
              value={player.highestSeasonRankedRankName ?? '–'}
              hint={
                player.highestSeasonRankedElo
                  ? `${formatNumber(player.highestSeasonRankedElo)} elo`
                  : undefined
              }
              tone="text-victory"
              badgeUrl={
                rankedTierIconUrl(player.highestSeasonRankedRank) ??
                rankedLeagueIconUrl(player.highestSeasonRankedRankName)
              }
            />
            <Cell
              gameIcon={<CrownIcon className="size-6" />}
              label="All-time best"
              value={player.highestAllTimeRankedRankName ?? '–'}
              hint={
                player.highestAllTimeRankedElo
                  ? `${formatNumber(player.highestAllTimeRankedElo)} elo`
                  : undefined
              }
              tone="text-brand"
              badgeUrl={
                rankedTierIconUrl(player.highestAllTimeRankedRank) ??
                rankedLeagueIconUrl(player.highestAllTimeRankedRankName)
              }
            />
          </>
        ) : null}

        {globalRank !== null ? (
          <Cell
            label="World rank"
            gameIcon={<TrophyIcon className="size-5" />}
            value={`#${globalRank}`}
            hint="Global trophies"
            tone="text-brand"
          />
        ) : null}

        {rankedStanding ? (
          <Cell
            gameIcon={<RankedIcon className="size-6" />}
            label="Ranked standing"
            value={`Top ${formatPercentileLabel(rankedStanding.percentile)}`}
            hint={`Of ${formatNumber(rankedStanding.population)} ranked players`}
            tone="text-victory"
          />
        ) : null}

        {standing ? (
          <Cell
            gameIcon={<PlayersIcon className="size-5" />}
            label="Trophy standing"
            value={`Top ${formatPercentileLabel(standing.percentile)}`}
            hint={`Of ${formatNumber(standing.population)} tracked players`}
            tone="text-accent"
          />
        ) : null}
      </div>
    </Panel>
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
  /** Last-resort glyph, for cells with neither tier art nor a game icon. */
  icon?: typeof TrendingUp;
  label: string;
  value: string;
  hint?: string;
  tone: string;
  /** Real tier artwork from the CDN; preferred over the glyph when present. */
  badgeUrl?: string | null;
  gameIcon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 ${tone}`}
      >
        {badgeUrl ? (
          <Image
            src={badgeUrl}
            alt=""
            width={36}
            height={36}
            className="size-9 object-contain"
            unoptimized
          />
        ) : (
          (gameIcon ?? (Icon ? <Icon className="size-5" /> : null))
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className="truncate text-base font-bold leading-tight">{titleCaseLabel(value)}</p>
      </div>
      {/* The elo sits on the row it belongs to rather than under the tier, so
          the column of numbers can be read down on its own. */}
      {hint ? (
        <p className="shrink-0 text-right text-xs tabular-nums text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
