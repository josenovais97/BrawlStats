import {
  Battle3v3Icon,
  BrawlersIcon,
  DuoShowdownIcon,
  ExperienceIcon,
  SoloShowdownIcon,
} from '@/components/game-icons';
import { StatCard } from '@/components/ui/stat-card';
import { formatNumber } from '@/lib/format';
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
      <StatCard
        node={<ExperienceIcon className="size-8" />}
        label="Exp points"
        value={formatNumber(player.expPoints)}
        hint={
          player.totalPrestigeLevel
            ? `Fame ${formatNumber(player.totalPrestigeLevel)}`
            : undefined
        }
      />
    </section>
  );
}
