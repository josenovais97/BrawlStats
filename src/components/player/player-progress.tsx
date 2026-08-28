import { CalendarDays, TrendingUp } from 'lucide-react';

import { TrophyGainIcon } from '@/components/game-icons';

import { SectionHeading } from '@/components/ui/section-heading';
import { StatCard } from '@/components/ui/stat-card';
import { formatNumber } from '@/lib/format';
import type { TrophyPoint } from '@/lib/stats';

/**
 * What a player has actually done lately, read off the trophy history.
 *
 * This is the whole of the trophy history now. There used to be a full-width
 * chart under it drawing the curve, and on a real profile it was a flat line:
 * the points are recorded when someone views the page, so a typical account
 * has a handful of them and no shape worth plotting. Worse, the curve was
 * spaced by point index rather than by date, so a gap of two months between
 * two views drew the same width as two consecutive days — the shape was not
 * only thin, it was misleading. A curve is not an answer; "am I up this month"
 * is, and that is what these three cards say.
 *
 * Windows are matched to the nearest recorded point rather than assumed to
 * exist: history only fills in on days someone looked the profile up, so a
 * "30 days" figure is labelled with the span it actually covers.
 */
export function PlayerProgress({
  points,
}: {
  points: TrophyPoint[];
}) {
  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const week = changeOver(points, 7);
  const month = changeOver(points, 30);
  const best = bestDay(points);

  // The full tracked span, which is the one figure that always exists — the
  // seven- and thirty-day windows need history reaching that far back, and a
  // profile first looked up on Tuesday has neither.
  const overall = last.trophies - first.trophies;
  const tracked = Math.max(
    1,
    Math.round((Date.parse(last.date) - Date.parse(first.date)) / 86_400_000),
  );

  // Nothing has moved and no window reaches back far enough to say anything.
  // A row of zeroes reads as a broken feature rather than an honest one.
  if (week === null && month === null && overall === 0) return null;

  return (
    <section>
      <SectionHeading
        title="Recent progress"
        subtitle="From the trophy points recorded on each profile view."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {week ? (
          <StatCard
            icon={TrendingUp}
            label={`Last ${week.days} days`}
            value={signed(week.change)}
            hint={`${formatNumber(week.from)} → ${formatNumber(week.to)}`}
            tone={week.change >= 0 ? 'text-victory' : 'text-defeat'}
          />
        ) : null}
        {month ? (
          <StatCard
            icon={CalendarDays}
            label={`Last ${month.days} days`}
            value={signed(month.change)}
            hint={`${formatNumber(month.from)} → ${formatNumber(month.to)}`}
            tone={month.change >= 0 ? 'text-victory' : 'text-defeat'}
          />
        ) : null}
        {best ? (
          <StatCard
            node={<TrophyGainIcon className="size-5" />}
            label="Best tracked day"
            value={signed(best.change)}
            hint={best.date}
            tone="text-brand"
          />
        ) : null}
      </div>

      {/*
        The span the numbers above are drawn from, and where they come from.
        It carries the caveat the removed chart used to carry: the history is
        only as dense as the times someone opened this profile, and saying so
        is what keeps "tracked 2 days" from reading as "played 2 days".
      */}
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted">
        <span>
          Tracked {tracked} {tracked === 1 ? 'day' : 'days'} &middot;{' '}
          <strong
            className={`font-semibold tabular-nums ${
              overall > 0 ? 'text-victory' : overall < 0 ? 'text-defeat' : 'text-foreground'
            }`}
          >
            {signed(overall)}
          </strong>{' '}
          overall, now on {formatNumber(last.trophies)}
        </span>
        <span className="text-xs">
          One point per day, recorded when this profile is viewed, so it covers the
          days someone checked rather than every day played.
        </span>
      </p>
    </section>
  );
}

function signed(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(value))}`;
}

/**
 * Change between the newest point and the nearest one at least `days` old.
 *
 * Returns null when the history does not reach back that far, rather than
 * silently comparing against whatever the oldest point happens to be — a
 * three-day history labelled "last 30 days" is a wrong number, not a partial
 * one.
 */
function changeOver(
  points: TrophyPoint[],
  days: number,
): { change: number; days: number; from: number; to: number } | null {
  const last = points[points.length - 1];
  const cutoff = Date.parse(last.date) - days * 86_400_000;

  // The newest point at or before the cutoff: the closest thing to "where they
  // were `days` ago" that the history can honestly supply.
  let anchor: TrophyPoint | null = null;
  for (const point of points) {
    if (Date.parse(point.date) <= cutoff) anchor = point;
  }
  if (!anchor) return null;

  const span = Math.round((Date.parse(last.date) - Date.parse(anchor.date)) / 86_400_000);
  if (span < 1) return null;

  return {
    change: last.trophies - anchor.trophies,
    days: span,
    from: anchor.trophies,
    to: last.trophies,
  };
}

/** The largest single-day climb in the tracked history. */
function bestDay(points: TrophyPoint[]): { change: number; date: string } | null {
  let best: { change: number; date: string } | null = null;

  for (let i = 1; i < points.length; i += 1) {
    const gap = Math.round(
      (Date.parse(points[i].date) - Date.parse(points[i - 1].date)) / 86_400_000,
    );
    // Only consecutive days: a gap of a fortnight between two views is not a
    // day's climb, however large the difference is.
    if (gap !== 1) continue;

    const change = points[i].trophies - points[i - 1].trophies;
    if (change > 0 && (!best || change > best.change)) {
      best = { change, date: points[i].date };
    }
  }

  return best;
}
