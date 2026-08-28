import {
  Battle3v3Icon,
  BigBrawlerIcon,
  BrawlersIcon,
  DuoShowdownIcon,
  ExperienceIcon,
  PrestigeIcon,
  RoboRumbleIcon,
  SoloShowdownIcon,
  TrophyIcon,
  WinStreakIcon,
} from '@/components/game-icons';
import { StatCard } from '@/components/ui/stat-card';
import { SectionHeading } from '@/components/ui/section-heading';
import { formatDuration, formatNumber, titleCaseLabel } from '@/lib/format';
import type { BSPlayer } from '@/types/brawlstars';

export function PlayerStats({ player }: { player: BSPlayer }) {
  // Ranked deliberately absent: the Ranking section directly below shows the
  // current, season-best and all-time-best tiers with their elo, so a card
  // repeating just the current tier was the weakest thing in this row.
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {/* The game's own marks, so the row reads as Brawl Stars rather than as a
          generic dashboard of line icons. */}
      <StatCard
        node={<Battle3v3Icon className="size-8" />}
        label="3v3 wins"
        value={formatNumber(player['3vs3Victories'])}
      />
      <StatCard
        node={<SoloShowdownIcon className="size-8" />}
        label="Solo SD wins"
        value={formatNumber(player.soloVictories)}
      />
      <StatCard
        node={<DuoShowdownIcon className="size-8" />}
        label="Duo SD wins"
        value={formatNumber(player.duoVictories)}
      />
      <StatCard
        node={<BrawlersIcon className="size-8" />}
        label="Brawlers"
        value={formatNumber(player.brawlers.length)}
        hint={`${player.brawlers.filter((b) => b.power === 11).length} at power 11`}
      />
      {/*
        No hint here. `totalPrestigeLevel` is prestige, not fame, and the header
        chip already shows it, so repeating it under exp points was both
        duplicated and mislabelled.
      */}
      <StatCard
        node={<ExperienceIcon className="size-8" />}
        label="Exp points"
        value={formatNumber(player.expPoints)}
      />
    </section>
  );
}

/**
 * The two survival records the API reports and nothing on the site showed.
 *
 * Their own strip rather than two more cards in the row above: that row is
 * lifetime counters, these are single best runs, and appending them made a
 * five-column grid wrap to five-plus-two. Rendered only when at least one is
 * set — the API reports zero for "never played", which as a time would read as
 * an impressively bad run rather than as absence.
 */
export function PlayerRecords({ player }: { player: BSPlayer }) {
  const robo = formatDuration(player.bestRoboRumbleTime);
  const bigBrawler = formatDuration(player.bestTimeAsBigBrawler);

  // All-time bests hiding in the per-brawler payload. `maxWinStreak` and the
  // per-brawler `highestTrophies` have always been in the response and were
  // never shown anywhere — on a long-lived account they are usually the two
  // most impressive numbers on the page.
  const bestStreak = player.brawlers.reduce<BSPlayer['brawlers'][number] | null>(
    (best, b) => ((b.maxWinStreak ?? 0) > (best?.maxWinStreak ?? 0) ? b : best),
    null,
  );
  const bestBrawler = player.brawlers.reduce<BSPlayer['brawlers'][number] | null>(
    (best, b) => (b.highestTrophies > (best?.highestTrophies ?? 0) ? b : best),
    null,
  );

  const cards = [
    bestBrawler && bestBrawler.highestTrophies > 0 ? (
      <StatCard
        key="best-brawler"
        node={<TrophyIcon className="size-8" />}
        label="Best brawler"
        value={formatNumber(bestBrawler.highestTrophies)}
        hint={titleCaseLabel(bestBrawler.name)}
      />
    ) : null,
    bestStreak && (bestStreak.maxWinStreak ?? 0) > 0 ? (
      <StatCard
        key="streak"
        node={<WinStreakIcon className="size-8" />}
        label="Best win streak"
        value={formatNumber(bestStreak.maxWinStreak ?? 0)}
        hint={titleCaseLabel(bestStreak.name)}
      />
    ) : null,
    player.totalPrestigeLevel ? (
      <StatCard
        key="prestige"
        node={<PrestigeIcon total={player.totalPrestigeLevel} className="size-8" />}
        label="Total prestige"
        value={formatNumber(player.totalPrestigeLevel)}
        hint="Across every brawler"
      />
    ) : null,
    robo ? (
      <StatCard
        key="robo"
        node={<RoboRumbleIcon className="size-8" />}
        label="Robo Rumble"
        value={robo}
        hint="Longest survival"
      />
    ) : null,
    bigBrawler ? (
      <StatCard
        key="big"
        node={<BigBrawlerIcon className="size-8" />}
        label="Big Brawler"
        value={bigBrawler}
        hint="Longest time as the Big Brawler"
      />
    ) : null,
  ].filter(Boolean);

  if (cards.length === 0) return null;

  return (
    <section>
      <SectionHeading title="Personal bests" aside="All-time" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{cards}</div>
    </section>
  );
}
