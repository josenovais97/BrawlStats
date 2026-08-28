import { formatPercent } from "@/lib/format";
import type { BrawlerTrendPoint } from "@/lib/stats";

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
}: {
  points: BrawlerTrendPoint[];
  accent: string;
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
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${x(i).toFixed(2)} ${y(p.normalizedWinRate).toFixed(2)}`,
    )
    .join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const days = usable.length;

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
            delta >= 0.002
              ? "text-victory"
              : delta <= -0.002
                ? "text-defeat"
                : "text-muted"
          }`}
        >
          {delta >= 0.002 ? "+" : delta <= -0.002 ? "−" : "±"}
          {Math.abs(delta * 100).toFixed(1)} pts
        </p>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="mt-3 h-16 w-full"
        role="img"
        aria-label={`Adjusted win rate over the last ${days} daily snapshots, from ${formatPercent(first)} to ${formatPercent(last)}`}
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

      <p className="mt-2 text-xs text-muted">
        {days} daily snapshots. Adjusted against the sample average, so a shift
        here is the brawler moving rather than the cohort.
      </p>
    </div>
  );
}
