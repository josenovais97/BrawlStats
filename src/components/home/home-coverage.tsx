import { CountUp } from '@/components/ui/count-up';
import { RelativeTime } from '@/components/ui/relative-time';
import { BattlesIcon, BrawlersIcon, PlayersIcon, RankedIcon } from '@/components/game-icons';
import { relativeTime } from '@/lib/format';
import { getCoverageStats, getLastAggregationRun } from '@/lib/stats';

/**
 * The live-data rail at the base of the hero.
 *
 * One continuous surface with hairline separators, not four cards. The
 * difference matters: four cards is a dashboard someone assembled, a rail is
 * an instrument reading out. It closes the command-centre scene above it — the
 * console asks a question, the rail says how much evidence stands behind the
 * answer.
 *
 * The sampling status leads rather than trailing. Anyone can print a large
 * number; saying when it was last checked is the claim only a site that
 * actually samples can make, and it belongs at the front of the readout.
 *
 * Renders nothing when there is no database or nothing collected yet — a strip
 * of zeroes would undercut the credibility it exists to build.
 */
export async function HomeCoverage() {
  const [stats, lastRun] = await Promise.all([getCoverageStats(), getLastAggregationRun()]);
  if (!stats || stats.battles === 0) return null;

  const items = [
    { icon: BrawlersIcon, label: 'Brawlers tracked', value: stats.brawlers },
    { icon: PlayersIcon, label: 'Players sampled', value: stats.players },
    { icon: BattlesIcon, label: 'Battles analysed', value: stats.battles },
    { icon: RankedIcon, label: 'Ranked battles', value: stats.rankedBattles },
  ];

  return (
    <section aria-label="Data coverage" className="relative">
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        {/* Status, at the head of the readout. */}
        <p className="flex items-center gap-2.5 py-3.5 text-xs text-muted lg:w-56 lg:shrink-0 lg:border-r lg:border-border/60 lg:py-5 lg:pr-6">
          <span className="live-dot shrink-0" />
          <span className="min-w-0">
            {lastRun ? (
              <>
                Sampled{' '}
                <RelativeTime
                  iso={lastRun.startedAt}
                  fallback={relativeTime(lastRun.startedAt)}
                  className="font-semibold text-foreground"
                />
                <span className="block text-muted">Re-read every two hours</span>
              </>
            ) : (
              <span className="font-semibold text-foreground">Live sample</span>
            )}
          </span>
        </p>

        {/*
          Two across on a phone, four across from `lg`. The separators are
          drawn per cell rather than with `divide-x`, because the wrap point
          differs between the two layouts and `divide` would leave a rule
          hanging at the end of the first row.
        */}
        <ul className="grid flex-1 grid-cols-2 border-t border-border/60 lg:grid-cols-4 lg:border-t-0">
          {items.map(({ icon: Icon, label, value }, index) => (
            <li
              key={label}
              className={`flex items-center gap-3 py-4 lg:py-5 lg:pl-6 ${
                index % 2 === 1 ? 'border-l border-border/60 pl-4 sm:pl-6 lg:pl-6' : ''
              } ${index > 1 ? 'border-t border-border/60 lg:border-t-0' : ''} ${
                index === 2 ? 'lg:border-l lg:border-border/60' : ''
              } ${index === 3 ? 'lg:border-l lg:border-border/60' : ''}`}
            >
              <Icon className="size-7 shrink-0 opacity-90 sm:size-8" />
              <div className="min-w-0">
                {/* `tabular-nums` is what keeps the label below from shuffling
                    sideways while the digits above it are still moving. */}
                <p className="display text-2xl leading-none tabular-nums text-foreground sm:text-[1.75rem]">
                  <CountUp value={value} />
                </p>
                <p className="mt-1.5 truncate text-xs font-medium uppercase tracking-wide text-muted">
                  {label}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
