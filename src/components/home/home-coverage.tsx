import { Swords, Trophy, Users, Zap } from 'lucide-react';

import { compactNumber } from '@/lib/format';
import { getCoverageStats } from '@/lib/stats';

/**
 * Real coverage numbers, straight from the database.
 *
 * Renders nothing when there is no database or nothing collected yet — a strip
 * of zeroes would undercut the credibility it exists to build.
 */
export async function HomeCoverage() {
  const stats = await getCoverageStats();
  if (!stats || stats.battles === 0) return null;

  const items = [
    { icon: Swords, label: 'Brawlers tracked', value: compactNumber(stats.brawlers) },
    { icon: Users, label: 'Players sampled', value: compactNumber(stats.players) },
    { icon: Zap, label: 'Battles analysed', value: compactNumber(stats.battles) },
    { icon: Trophy, label: 'Ranked placements', value: compactNumber(stats.placements) },
  ];

  return (
    <section className="card card-glow overflow-hidden">
      <ul className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
        {items.map(({ icon: Icon, label, value }, index) => (
          <li
            key={label}
            className={`flex items-center gap-3 p-5 ${
              index > 0 ? 'lg:border-l lg:border-border' : ''
            } ${index === 1 ? 'sm:border-l sm:border-border' : ''} ${
              index === 3 ? 'sm:border-l sm:border-border' : ''
            }`}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-brand">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="display text-2xl leading-none">{value}</p>
              <p className="mt-1.5 truncate text-xs uppercase tracking-wide text-muted">
                {label}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
