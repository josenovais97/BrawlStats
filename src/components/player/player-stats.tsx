import { Award, Medal, Swords, Target, TrendingUp, Users } from 'lucide-react';

import { StatCard } from '@/components/ui/stat-card';
import { formatNumber } from '@/lib/format';
import type { BSPlayer } from '@/types/brawlstars';

export function PlayerStats({ player }: { player: BSPlayer }) {
  const rankedName = player.rankedRankName ?? 'Unranked';
  const highestRankedName = player.highestAllTimeRankedRankName;

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard
        icon={Swords}
        label="3v3 wins"
        value={formatNumber(player['3vs3Victories'])}
      />
      <StatCard
        icon={Target}
        label="Solo SD wins"
        value={formatNumber(player.soloVictories)}
        tone="text-victory"
      />
      <StatCard
        icon={Users}
        label="Duo SD wins"
        value={formatNumber(player.duoVictories)}
        tone="text-victory"
      />
      <StatCard
        icon={Medal}
        label="Ranked"
        value={rankedName}
        hint={highestRankedName ? `Best ${highestRankedName}` : undefined}
        tone="text-accent"
      />
      <StatCard
        icon={TrendingUp}
        label="Brawlers"
        value={formatNumber(player.brawlers.length)}
        hint={`${player.brawlers.filter((b) => b.power === 11).length} at power 11`}
      />
      <StatCard
        icon={Award}
        label="Exp points"
        value={formatNumber(player.expPoints)}
        hint={
          player.totalPrestigeLevel
            ? `Prestige ${formatNumber(player.totalPrestigeLevel)}`
            : undefined
        }
      />
    </section>
  );
}
