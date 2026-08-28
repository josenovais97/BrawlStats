import Image from 'next/image';
import Link from 'next/link';

import { VersusList, type VersusSection } from '@/components/compare/versus-list';
import { SectionHeading } from '@/components/ui/section-heading';
import { playerIconUrl } from '@/lib/brawlapi';
import { formatNumber, formatPercent, nameColorToCss, titleCaseLabel } from '@/lib/format';
import type { CompareOutcome, PlayerSide } from '@/lib/player-compare';
import { displayTag } from '@/lib/tags';

/**
 * Two accounts side by side.
 *
 * Every metric here is read straight off the player payload or computed by the
 * same functions the profile page uses. Nothing is invented to fill the table:
 * a statistic the API does not publish simply is not a row.
 *
 * Leaders are marked with weight and colour rather than a badge. A comparison
 * is a reference, not a contest, and "WINNER" styling would make it read as a
 * verdict on two people rather than a readout of two accounts.
 */
export function PlayerVersus({ a, b }: { a: CompareOutcome; b: CompareOutcome }) {
  // One bad tag should not take the other side down with it.
  if (!a.ok || !b.ok) {
    return (
      <section>
        <SectionHeading title="Comparison" />
        <div className="grid gap-3 sm:grid-cols-2">
          <SideStatus outcome={a} position="Player 1" />
          <SideStatus outcome={b} position="Player 2" />
        </div>
      </section>
    );
  }

  const left = a.side;
  const right = b.side;

  /** Higher wins, with a dead band so a rounding difference is not a lead. */
  const higher = (x: number, y: number, epsilon = 0.0001): 'a' | 'b' | null =>
    Math.abs(x - y) <= epsilon ? null : x > y ? 'a' : 'b';

  const sections: VersusSection[] = [
    {
      title: 'Trophies',
      metrics: [
        {
          label: 'Current trophies',
          a: formatNumber(left.player.trophies),
          b: formatNumber(right.player.trophies),
          leader: higher(left.player.trophies, right.player.trophies),
        },
        {
          label: 'Peak trophies',
          a: formatNumber(left.player.highestTrophies),
          b: formatNumber(right.player.highestTrophies),
          leader: higher(left.player.highestTrophies, right.player.highestTrophies),
        },
        {
          label: 'Average per brawler',
          a: Math.round(left.averageTrophies).toLocaleString('en-US'),
          b: Math.round(right.averageTrophies).toLocaleString('en-US'),
          leader: higher(left.averageTrophies, right.averageTrophies),
          hint: 'Total trophies divided by brawlers unlocked. A rough measure of depth rather than breadth.',
        },
      ],
    },
    {
      title: 'Account strength',
      metrics: [
        {
          label: 'Skill score',
          a: `${left.skill.toFixed(1)} · ${titleCaseLabel(left.skillTier)}`,
          b: `${right.skill.toFixed(1)} · ${titleCaseLabel(right.skillTier)}`,
          leader: higher(left.skill, right.skill, 0.05),
          hint: 'A BrawlZone metric out of 10, not an official Brawl Stars statistic.',
        },
        {
          label: 'Roster unlocked',
          a: formatPercent(left.rosterShare),
          b: formatPercent(right.rosterShare),
          leader: higher(left.rosterShare, right.rosterShare, 0.001),
        },
        {
          label: 'Brawlers unlocked',
          a: formatNumber(left.player.brawlers.length),
          b: formatNumber(right.player.brawlers.length),
          leader: higher(left.player.brawlers.length, right.player.brawlers.length),
        },
        {
          label: 'Power 11 brawlers',
          a: formatNumber(left.power11),
          b: formatNumber(right.power11),
          leader: higher(left.power11, right.power11),
        },
        {
          label: 'Hypercharges',
          a: formatNumber(left.hyperCharges),
          b: formatNumber(right.hyperCharges),
          leader: higher(left.hyperCharges, right.hyperCharges),
        },
        {
          label: 'Prestige',
          a: formatNumber(left.prestige),
          b: formatNumber(right.prestige),
          leader: higher(left.prestige, right.prestige),
        },
      ],
    },
    {
      title: 'Competitive',
      metrics: [
        {
          label: 'Ranked elo',
          a: left.player.rankedElo ? formatNumber(left.player.rankedElo) : 'Unranked',
          b: right.player.rankedElo ? formatNumber(right.player.rankedElo) : 'Unranked',
          leader: higher(left.player.rankedElo ?? 0, right.player.rankedElo ?? 0),
        },
        {
          label: 'Peak Ranked',
          a: titleCaseLabel(left.player.highestAllTimeRankedRankName ?? '') || '–',
          b: titleCaseLabel(right.player.highestAllTimeRankedRankName ?? '') || '–',
          leader: higher(
            left.player.highestAllTimeRankedElo ?? 0,
            right.player.highestAllTimeRankedElo ?? 0,
          ),
        },
        {
          label: '3v3 wins',
          a: formatNumber(left.player['3vs3Victories']),
          b: formatNumber(right.player['3vs3Victories']),
          leader: higher(left.player['3vs3Victories'], right.player['3vs3Victories']),
        },
        {
          label: 'Best win streak',
          a: formatNumber(left.bestWinStreak),
          b: formatNumber(right.bestWinStreak),
          leader: higher(left.bestWinStreak, right.bestWinStreak),
          hint: 'The highest streak on any single brawler. The API publishes no account-wide streak.',
        },
      ],
    },
  ];

  return (
    <section aria-labelledby="player-versus">
      <div id="player-versus">
        <SectionHeading
          title="Head to head"
          subtitle="Both accounts read live from the official API. Nothing is stored."
        />
      </div>

      <div className="space-y-4">
        <div className="card grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4">
          <Identity side={left} align="start" />
          <span className="display text-sm uppercase text-muted sm:text-lg">vs</span>
          <Identity side={right} align="end" />
        </div>

        <VersusList
          sections={sections}
          labelA={left.player.name}
          labelB={right.player.name}
          accentA={nameColorToCss(left.player.nameColor)}
          accentB={nameColorToCss(right.player.nameColor)}
        />
      </div>
    </section>
  );
}

function Identity({ side, align }: { side: PlayerSide; align: 'start' | 'end' }) {
  return (
    <Link
      href={`/player/${side.tag}`}
      className={`flex min-w-0 items-center gap-2.5 ${
        align === 'end' ? 'flex-row-reverse text-right' : 'text-left'
      }`}
    >
      <Image
        src={playerIconUrl(side.player.icon?.id)}
        alt=""
        width={48}
        height={48}
        sizes="48px"
        className="size-11 shrink-0 rounded-xl bg-surface-2 sm:size-12"
        unoptimized
      />
      <span className="min-w-0">
        <span
          className="block truncate font-bold"
          style={{ color: nameColorToCss(side.player.nameColor) }}
        >
          {side.player.name}
        </span>
        <span className="block truncate font-mono text-xs text-muted">
          {displayTag(side.player.tag)}
        </span>
      </span>
    </Link>
  );
}

/** A clean unavailable column, so one bad tag does not blank the page. */
function SideStatus({
  outcome,
  position,
}: {
  outcome: CompareOutcome;
  position: string;
}) {
  if (outcome.ok) {
    return (
      <div className="card p-4">
        <p className="text-xs uppercase tracking-wide text-muted">{position}</p>
        <p className="mt-1 font-bold">{outcome.side.player.name}</p>
        <p className="text-sm text-muted">Ready. Waiting on the other player.</p>
      </div>
    );
  }

  const message = {
    invalid: 'That player tag doesn’t look valid. Tags use the characters 0289PYLQGRJCUV.',
    notFound: 'We couldn’t find that player. Check the tag in-game under your profile.',
    unavailable: 'Brawl Stars data is temporarily unavailable. Try again shortly.',
  }[outcome.reason];

  return (
    <div className="card border-defeat/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{position}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{message}</p>
    </div>
  );
}
