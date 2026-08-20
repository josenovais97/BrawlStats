import {
  BattlesIcon,
  BrawlersIcon,
  PlayersIcon,
  RankedIcon,
} from '@/components/game-icons';
import { RelativeTime } from '@/components/ui/relative-time';
import { compactNumber, relativeTime } from '@/lib/format';
import { getCoverageStats, getLastAggregationRun } from '@/lib/stats';

/**
 * Real coverage numbers, straight from the database.
 *
 * Renders nothing when there is no database or nothing collected yet — a strip
 * of zeroes would undercut the credibility it exists to build.
 */
export async function HomeCoverage() {
  const [stats, lastRun] = await Promise.all([
    getCoverageStats(),
    getLastAggregationRun(),
  ]);
  if (!stats || stats.battles === 0) return null;

  const items = [
    { icon: BrawlersIcon, label: 'Brawlers tracked', value: compactNumber(stats.brawlers) },
    { icon: PlayersIcon, label: 'Players sampled', value: compactNumber(stats.players) },
    { icon: BattlesIcon, label: 'Battles analysed', value: compactNumber(stats.battles) },
    { icon: RankedIcon, label: 'Ranked placements', value: compactNumber(stats.placements) },
  ];

  return (
    /*
      A ribbon, not a table.
      
      This was four icon-and-label cells inside a bordered box, which read as a
      spec sheet. The numbers are the proof, so they get the display face at a
      size you cannot miss, the icons drop to a quiet tint behind them, and the
      container loses its border in favour of a translucent surface with one
      lit top edge.
    */
    <section
      aria-label="Data coverage"
      className="relative overflow-hidden rounded-2xl bg-surface/60 backdrop-blur-sm"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--brand) 40%, transparent), color-mix(in srgb, var(--accent) 30%, transparent), transparent)',
        }}
      />
      {/*
        Two columns on a phone rather than four stacked rows: these are four
        short numbers, and stacking them turns a one-line credibility strip
        into half a screen of scrolling.
      */}
      <ul className="grid grid-cols-2 md:grid-cols-4">
        {items.map(({ icon: Icon, label, value }, index) => (
          <li
            key={label}
            className={`relative flex items-center gap-3 p-3.5 sm:p-4 sm:px-5 ${
              index % 2 === 1 ? 'border-l border-border/60' : ''
            } ${index > 1 ? 'border-t border-border/60 md:border-t-0' : ''} ${
              index === 2 ? 'md:border-l md:border-border/60' : ''
            }`}
          >
            <Icon className="size-7 shrink-0 opacity-90 sm:size-8" />
            <div className="min-w-0">
              <p className="display text-2xl leading-none tabular-nums text-foreground sm:text-3xl">
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

      {/*
        The line that makes the four numbers above mean something.
        
        Anyone can print a big number. Saying when it was last checked is a
        claim only a site that actually samples can make, and it is the closest
        thing this page has to a proof of life. The instant is rendered by
        `RelativeTime` so a cached page never shows a stale "20 minutes ago".
      */}
      {lastRun ? (
        <p className="flex items-center gap-2 border-t border-border/60 bg-background/30 px-3.5 py-2.5 text-xs text-muted sm:px-5">
          <span className="live-dot shrink-0" />
          <span className="min-w-0">
            Last sampled{' '}
            <RelativeTime
              iso={lastRun.startedAt}
              fallback={relativeTime(lastRun.startedAt)}
              className="font-semibold text-foreground"
            />
            {' '}&middot; we re-read the pool every three hours
          </span>
        </p>
      ) : null}
    </section>
  );
}
