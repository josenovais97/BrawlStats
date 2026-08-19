import { CalendarDays, Flame, TrendingUp } from 'lucide-react';

import { ShareButton } from '@/components/player/share-button';
import { SectionHeading } from '@/components/ui/section-heading';
import { StatCard } from '@/components/ui/stat-card';
import { formatNumber } from '@/lib/format';
import type { TrophyPoint } from '@/lib/stats';

/**
 * What a player has actually done lately, read off the trophy history.
 *
 * The chart underneath already draws the whole curve, but a curve is not an
 * answer — "am I up this month" is, and it is the thing a returning visitor
 * comes back to check. Everything here comes from points the site already
 * stores, so it costs no extra query.
 *
 * Windows are matched to the nearest recorded point rather than assumed to
 * exist: history only fills in on days someone looked the profile up, so a
 * "30 days" figure is labelled with the span it actually covers.
 */
export function PlayerProgress({
  points,
  playerName,
}: {
  points: TrophyPoint[];
  playerName: string;
}) {
  if (points.length < 2) return null;

  const last = points[points.length - 1];
  const week = changeOver(points, 7);
  const month = changeOver(points, 30);
  const best = bestDay(points);

  // Nothing has moved and nothing is worth saying. A row of zeroes reads as a
  // broken feature rather than an honest one.
  if (week === null && month === null) return null;

  const headline = month ?? week!;
  const shareText = `${playerName} is ${headline.change >= 0 ? 'up' : 'down'} ${formatNumber(
    Math.abs(headline.change),
  )} trophies over the last ${headline.days} days. Now on ${formatNumber(last.trophies)}.`;

  return (
    <section>
      <SectionHeading
        title="Recent progress"
        subtitle="From the trophy points recorded on each profile view."
        aside={<ShareButton title={`${playerName} on BrawlZone`} text={shareText} />}
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
            icon={Flame}
            label="Best tracked day"
            value={signed(best.change)}
            hint={best.date}
            tone="text-brand"
          />
        ) : null}
      </div>
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
