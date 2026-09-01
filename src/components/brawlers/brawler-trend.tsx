import { formatPercent } from '@/lib/format';
import { CHANGE_LABEL, type BalanceEvent } from '@/lib/release-notes';
import type { BrawlerTrendPoint } from '@/lib/stats';

/** UTC-anchored so the server and the browser format the same string. */
function shortDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * A brawler's adjusted win rate over the stored snapshots.
 *
 * Drawn as inline SVG rather than with a charting library: it is one series of
 * at most thirty points, and a dependency that ships a layout engine to draw a
 * polyline would be most of this page's JavaScript budget for the least of its
 * content.
 *
 * The adjusted rate is plotted, not the raw one. Raw win rate moves whenever
 * the sampled cohort's average does — a week where the pool skews stronger
 * lifts every brawler at once — and a chart of that reads as a balance change
 * that never happened.
 */
export function BrawlerTrend({
  points,
  accent,
  events = [],
}: {
  points: BrawlerTrendPoint[];
  accent: string;
  events?: BalanceEvent[];
}) {
  const usable = points.filter(
    (p): p is BrawlerTrendPoint & { normalizedWinRate: number } =>
      p.normalizedWinRate !== null,
  );

  // Two points is a line between two days, which is not a trend. Below that
  // the section is simply absent rather than showing a flat stub.
  if (usable.length < 3) return null;

  const values = usable.map((p) => p.normalizedWinRate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Never let the band collapse: a brawler that held 51.2% all fortnight would
  // otherwise be drawn as a wildly spiking line across a zero-height range.
  const padding = Math.max((max - min) * 0.25, 0.01);
  const low = min - padding;
  const high = max + padding;

  const width = 100;
  const height = 32;
  const x = (i: number) => (i / (usable.length - 1)) * width;
  const y = (value: number) => height - ((value - low) / (high - low)) * height;

  const line = usable
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)} ${y(p.normalizedWinRate).toFixed(2)}`)
    .join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const days = usable.length;

  /*
   * Each update is placed on the first snapshot at or after it was published,
   * because that is the first day the chart could possibly show its effect.
   * An update older than the window has no position on this chart and is
   * dropped rather than pinned to the left edge, where it would read as having
   * happened at the start of the period.
   */
  const marks = events
    .map((event) => {
      const day = event.date.slice(0, 10);
      const index = usable.findIndex((p) => p.date.slice(0, 10) >= day);
      return index === -1 ? null : { event, index };
    })
    .filter((m): m is { event: BalanceEvent; index: number } => m !== null);

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Adjusted win rate
          </p>
          <p className="mt-0.5 text-2xl font-black tabular-nums">
            {formatPercent(last)}
          </p>
        </div>
        <p
          className={`text-sm font-bold tabular-nums ${
            delta >= 0.002 ? 'text-victory' : delta <= -0.002 ? 'text-defeat' : 'text-muted'
          }`}
        >
          {delta >= 0.002 ? '+' : delta <= -0.002 ? '−' : '±'}
          {Math.abs(delta * 100).toFixed(1)} pts
        </p>
      </div>

      {/* The markers are HTML over the chart rather than SVG inside it: the
          viewBox is stretched by `preserveAspectRatio="none"`, which would
          shear any text drawn in it. */}
      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-16 w-full"
          role="img"
          aria-label={`Adjusted win rate over the last ${days} daily snapshots, from ${formatPercent(first)} to ${formatPercent(last)}${
            marks.length > 0
              ? `. Balance updates on ${marks.map((m) => shortDate(m.event.date)).join(' and ')}.`
              : ''
          }`}
        >
          <path d={area} fill={accent} opacity={0.16} />
          <path
            d={line}
            fill="none"
            stroke={accent}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {marks.map(({ event, index }) => (
          <span
            key={event.date}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-px border-l border-dashed border-foreground/45"
            style={{ left: `${(index / (usable.length - 1)) * 100}%` }}
          >
            <span className="absolute -top-1 -left-[3px] size-1.5 rounded-full bg-foreground/70" />
          </span>
        ))}
      </div>

      {marks.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {marks.map(({ event }) => (
            <li key={event.date} className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <span aria-hidden className="size-1.5 rounded-full bg-foreground/70" />
                {shortDate(event.date)}
              </span>
              <span className="text-muted">
                {event.categories.map((c) => CHANGE_LABEL[c]).join(' · ')}
              </span>
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand transition-colors hover:underline"
              >
                Patch notes
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 text-xs text-muted">
        {days} daily snapshots. Adjusted against the sample average, so a shift here
        is the brawler moving rather than the cohort.
        {marks.length > 0 ? ' Dashed lines mark updates that changed this brawler.' : ''}
      </p>
    </div>
  );
}
