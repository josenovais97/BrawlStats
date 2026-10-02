import { TrophyGainIcon, TrophyIcon } from '@/components/game-icons';

import { Panel } from '@/components/ui/panel';
import { formatNumber } from '@/lib/format';
import type { TrophyPoint } from '@/lib/stats';
import { trophyCurve } from '@/lib/trophy-curve';

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
  /*
   * Null far more often than not, and that is the design. See `trophy-curve`:
   * a chart only appears once there are enough views spread over enough days
   * to have a shape, because the alternative is a flat line between two dots
   * on most profiles -- which is why the previous one was deleted.
   */
  const curve = trophyCurve(points);

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
    <Panel
      title="Recent progress"
      subtitle="From the trophy points recorded on each profile view."
    >
      {curve ? (
        <figure className="mb-5">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-28 w-full sm:h-36"
            role="img"
            aria-label={`Trophy history over ${curve.days} days, from ${formatNumber(curve.low)} to ${formatNumber(curve.high)}`}
          >
            <defs>
              <linearGradient id="trophy-curve-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={curve.area} fill="url(#trophy-curve-fill)" />
            {/*
              `vector-effect` because the viewBox is stretched to the element's
              width with `preserveAspectRatio="none"`. Without it the stroke is
              scaled by the same factor and a 1-unit line comes out as a thick
              smear horizontally and a hairline vertically.
            */}
            <path
              d={curve.line}
              fill="none"
              stroke="var(--brand)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <figcaption className="mt-1.5 flex justify-between text-xs tabular-nums text-muted">
            <span className="flex items-center gap-1">
              <TrophyIcon className="size-3.5" />
              {formatNumber(curve.low)}
            </span>
            <span>
              {curve.points} views over {curve.days} days
            </span>
            <span>{formatNumber(curve.high)}</span>
          </figcaption>
        </figure>
      ) : null}

      {/*
        The same treatment as the strips above it, not the old icon-tile card.
        Three figures under a chart, inside a panel, do not each need a border
        and a rounded icon well -- and two different ways of drawing a number
        on one tab is exactly what made this page read as assembled rather
        than designed.
      */}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-5 @sm:grid-cols-3">
        {week ? (
          <Figure
            node={<TrophyGainIcon className="size-4" />}
            label={`Last ${week.days} days`}
            value={signed(week.change)}
            hint={`${formatNumber(week.from)} → ${formatNumber(week.to)}`}
            tone={week.change >= 0 ? 'text-victory' : 'text-defeat'}
          />
        ) : null}
        {month ? (
          <Figure
            node={<TrophyGainIcon className="size-4" />}
            label={`Last ${month.days} days`}
            value={signed(month.change)}
            hint={`${formatNumber(month.from)} → ${formatNumber(month.to)}`}
            tone={month.change >= 0 ? 'text-victory' : 'text-defeat'}
          />
        ) : null}
        {best ? (
          <Figure
            node={<TrophyGainIcon className="size-4" />}
            label="Best tracked day"
            value={signed(best.change)}
            hint={best.date}
            tone="text-brand"
          />
        ) : null}
      </dl>

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
    </Panel>
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

/** One figure, matching `StatStrip`'s treatment so the tab has one of them. */
function Figure({
  node,
  label,
  value,
  hint,
  tone,
}: {
  node: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
        <span aria-hidden className={`flex shrink-0 items-center ${tone}`}>
          {node}
        </span>
        <span className="truncate">{label}</span>
      </dt>
      <dd className={`mt-1.5 truncate text-xl font-bold tabular-nums leading-none ${tone}`}>
        {value}
      </dd>
      <dd className="mt-1 truncate text-xs text-muted">{hint}</dd>
    </div>
  );
}
