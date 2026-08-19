import { LineChart } from 'lucide-react';

import { SectionHeading } from '@/components/ui/section-heading';
import { formatNumber } from '@/lib/format';
import type { TrophyPoint } from '@/lib/stats';

/**
 * A player's own trophy curve, from the points recorded on each profile view.
 *
 * The history starts the first time someone looks a player up, so this renders
 * nothing until there are at least two days of it. That is the honest state
 * for a new profile — a single dot, or a line drawn between a point and
 * itself, would imply the site knows more than it does.
 *
 * Inline SVG rather than a charting library: it is one polyline over at most
 * ninety points, and the page already ships enough client JavaScript.
 */
export function PlayerTrophyHistory({ points }: { points: TrophyPoint[] }) {
  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const change = last.trophies - first.trophies;

  const values = points.map((p) => p.trophies);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat week would otherwise divide by zero and draw the line off-canvas.
  const span = max - min || 1;

  const W = 640;
  const H = 160;
  const PAD = 8;

  const x = (i: number) => (i / (points.length - 1)) * (W - PAD * 2) + PAD;
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);

  const line = points.map((p, i) => `${x(i)},${y(p.trophies)}`).join(' ');
  const area = `${x(0)},${H} ${line} ${x(points.length - 1)},${H}`;

  const days = Math.max(
    1,
    Math.round((Date.parse(last.date) - Date.parse(first.date)) / 86_400_000),
  );

  return (
    <section>
      <SectionHeading
        title="Trophy history"
        aside={`${days} ${days === 1 ? 'day' : 'days'} tracked`}
      />

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span
            className={`text-3xl font-black tabular-nums ${
              change > 0 ? 'text-victory' : change < 0 ? 'text-defeat' : 'text-muted'
            }`}
          >
            {change > 0 ? '+' : change < 0 ? '−' : ''}
            {formatNumber(Math.abs(change))}
          </span>
          <span className="text-sm text-muted">
            {formatNumber(first.trophies)} → {formatNumber(last.trophies)} trophies
            {last.brawlerCount !== first.brawlerCount
              ? `, ${last.brawlerCount - first.brawlerCount} new ${
                  last.brawlerCount - first.brawlerCount === 1 ? 'brawler' : 'brawlers'
                }`
              : ''}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-40 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Trophy count from ${formatNumber(first.trophies)} on ${first.date} to ${formatNumber(last.trophies)} on ${last.date}`}
        >
          <defs>
            <linearGradient id="trophy-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#trophy-fill)" />
          <polyline
            points={line}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="mt-2 flex justify-between text-xs tabular-nums text-muted">
          <span>{first.date}</span>
          <span>{last.date}</span>
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-lg bg-surface-2 px-4 py-3 text-xs leading-relaxed text-muted">
          <LineChart className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>
            One point per day, recorded when this profile is viewed. So the line
            covers the days someone checked, not every day played. It fills in as
            the profile gets looked at.
          </span>
        </p>
      </div>
    </section>
  );
}
