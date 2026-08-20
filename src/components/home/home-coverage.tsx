import {
  BattlesIcon,
  BrawlersIcon,
  PlayersIcon,
  RankedIcon,
} from '@/components/game-icons';
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
    { icon: BrawlersIcon, label: 'Brawlers tracked', value: compactNumber(stats.brawlers) },
    { icon: PlayersIcon, label: 'Players sampled', value: compactNumber(stats.players) },
    { icon: BattlesIcon, label: 'Battles analysed', value: compactNumber(stats.battles) },
    { icon: RankedIcon, label: 'Ranked placements', value: compactNumber(stats.placements) },
  ];

  return (
    <section aria-label="Data coverage" className="card overflow-hidden">
      {/*
        Two columns on a phone rather than four stacked rows: these are four
        short numbers, and stacking them turns a one-line credibility strip
        into half a screen of scrolling.
      */}
      <ul className="grid grid-cols-2 md:grid-cols-4">
        {items.map(({ icon: Icon, label, value }, index) => (
          <li
            key={label}
            className={`flex items-center gap-2.5 p-3.5 sm:gap-3 sm:p-4 sm:px-5 ${
              index % 2 === 1 ? 'border-l border-border' : ''
            } ${index > 1 ? 'border-t border-border md:border-t-0' : ''} ${
              index === 2 ? 'md:border-l md:border-border' : ''
            }`}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-brand sm:size-11">
              <Icon className="size-4.5 sm:size-5" />
            </span>
            <div className="min-w-0">
              <p className="display text-xl leading-none tabular-nums sm:text-2xl">
                {value}
              </p>
              {/*
                Wrapping rather than truncating: at 320px "Ranked placements"
                does not fit on one line, and a clipped label is worse than a
                two-line one.
              */}
              <p className="mt-1.5 text-xs font-medium uppercase leading-tight tracking-wide text-muted">
                {label}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
