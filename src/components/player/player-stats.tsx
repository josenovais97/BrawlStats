import { Bot, Timer } from 'lucide-react';

import {
  Battle3v3Icon,
  BrawlersIcon,
  DuoShowdownIcon,
  ExperienceIcon,
  SoloShowdownIcon,
} from '@/components/game-icons';
import { StatCard } from '@/components/ui/stat-card';
import { SectionHeading } from '@/components/ui/section-heading';
import { formatDuration, formatNumber } from '@/lib/format';
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
  if (!robo && !bigBrawler) return null;

  return (
    <section>
      <SectionHeading title="Personal bests" aside="Survival modes" />
      <div className="grid gap-3 sm:grid-cols-2">
        {robo ? (
          <StatCard
            node={<Bot className="size-8 text-accent" />}
            label="Robo Rumble"
            value={robo}
            hint="Longest survival"
          />
        ) : null}
        {bigBrawler ? (
          <StatCard
            node={<Timer className="size-8 text-brand" />}
            label="Big Brawler"
            value={bigBrawler}
            hint="Longest time as the Big Brawler"
          />
        ) : null}
      </div>
    </section>
  );
}
