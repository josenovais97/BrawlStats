import { RankedIcon, TrophyGainIcon, TrophyIcon } from '@/components/game-icons';

import { Panel } from '@/components/ui/panel';
import { formatNumber } from '@/lib/format';
import type { TrophyPoint } from '@/lib/stats';
import { trophyCurve } from '@/lib/trophy-curve';

/**
 * What a player has actually done lately, read off the recorded history: one
 * track for trophies and one for Ranked Elo, the same readings for each.
 *
 * Mostly figures, not a chart. The points are recorded when someone views the
 * page, so a typical account has a handful of them and no shape worth
 * plotting; a curve only appears once there are enough views spread over
 * enough days (see `trophy-curve`). "Am I up this month" is the answer, and
 * the figures say it.
 *
 * Windows are matched to the nearest recorded point rather than assumed to
 * exist, so a "30 days" figure is labelled with the span it actually covers.
 *
 * Ranked reuses every helper by reading Elo into the `trophies` slot: the
 * arithmetic is identical, and only the labels and colour differ.
 */
export function PlayerProgress({
  points,
}: {
  points: TrophyPoint[];
}) {
  const trophies = readTrack(points);
  const ranked = readTrack(
    points
      .filter((p) => typeof p.rankedElo === 'number' && p.rankedElo > 0)
      .map((p) => ({ ...p, trophies: p.rankedElo as number })),
  );

  if (!trophies && !ranked) return null;

  return (
    <Panel
      title="Recent progress"
      subtitle="Trophies and Ranked, from the points recorded on each profile view."
    >
      {/* Stacked, Trophies over Ranked, with a rule between: two halves of one
          reading rather than two panels competing side by side. */}
      <div className="divide-y divide-border/70 [&>section+section]:mt-6 [&>section+section]:pt-6">
        {trophies ? <TrackView track={trophies} kind="trophies" /> : null}
        {ranked ? <TrackView track={ranked} kind="ranked" /> : null}
      </div>

      {/* The caveat the history always needs: it is only as dense as the
          times someone opened this profile, which keeps "tracked 2 days"
          from reading as "played 2 days". */}
      <p className="mt-5 text-xs text-muted">
        One point per day, recorded when this profile is viewed, so it covers the days someone
        checked rather than every day played.
      </p>
    </Panel>
  );
}

interface Track {
  last: TrophyPoint;
  week: ReturnType<typeof changeOver>;
  month: ReturnType<typeof changeOver>;
  best: ReturnType<typeof bestDay>;
  curve: ReturnType<typeof trophyCurve>;
  overall: number;
  tracked: number;
}

/** One history read into its figures, or null when it has nothing to say. */
function readTrack(points: TrophyPoint[]): Track | null {
  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const week = changeOver(points, 7);
  const month = changeOver(points, 30);
  const overall = last.trophies - first.trophies;

  // Nothing has moved and no window reaches back far enough to say anything.
  // A row of zeroes reads as a broken feature rather than an honest one.
  if (week === null && month === null && overall === 0) return null;

  return {
    last,
    week,
    month,
    best: bestDay(points),
    curve: trophyCurve(points),
    overall,
    tracked: Math.max(
      1,
      Math.round((Date.parse(last.date) - Date.parse(first.date)) / 86_400_000),
    ),
  };
}

const KINDS = {
  trophies: {
    title: 'Trophies',
    icon: (c: string) => <TrophyIcon className={c} />,
    gain: (c: string) => <TrophyGainIcon className={c} />,
    colour: 'var(--brand)',
    tone: 'text-brand',
    unit: '',
  },
  ranked: {
    title: 'Ranked',
    icon: (c: string) => <RankedIcon className={c} />,
    gain: (c: string) => <RankedIcon className={c} />,
    colour: 'var(--accent)',
    tone: 'text-accent',
    unit: ' Elo',
  },
} as const;

function TrackView({ track, kind }: { track: Track; kind: keyof typeof KINDS }) {
  const k = KINDS[kind];
  const { last, week, month, best, curve, overall, tracked } = track;
  const gradient = `progress-fill-${kind}`;

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className={`flex items-center gap-2 text-sm font-black uppercase tracking-wide ${k.tone}`}>
          {k.icon('size-6')}
          {k.title}
        </h3>
        <p className="text-sm tabular-nums text-muted">
          Now{' '}
          <strong className="text-lg font-black text-foreground">
            {formatNumber(last.trophies)}
          </strong>
          {k.unit}
        </p>
      </div>

      {curve ? (
        <figure className="mb-5">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-24 w-full sm:h-32"
            role="img"
            aria-label={`${k.title} history over ${curve.days} days, from ${formatNumber(curve.low)} to ${formatNumber(curve.high)}`}
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={k.colour} stopOpacity="0.35" />
                <stop offset="100%" stopColor={k.colour} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={curve.area} fill={`url(#${gradient})`} />
            {/* `vector-effect` because the viewBox is stretched with
                `preserveAspectRatio="none"`; without it the stroke scales too
                and comes out a smear one way and a hairline the other. */}
            <path
              d={curve.line}
              fill="none"
              stroke={k.colour}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <figcaption className="mt-1.5 flex justify-between text-xs tabular-nums text-muted">
            <span>{formatNumber(curve.low)}</span>
            <span>
              {curve.points} views over {curve.days} days
            </span>
            <span>{formatNumber(curve.high)}</span>
          </figcaption>
        </figure>
      ) : null}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-5 @sm:grid-cols-3">
        {week ? (
          <Figure
            node={k.gain('size-4')}
            label={`Last ${week.days} days`}
            value={signed(week.change)}
            hint={`${formatNumber(week.from)} → ${formatNumber(week.to)}`}
            tone={week.change >= 0 ? 'text-victory' : 'text-defeat'}
          />
        ) : null}
        {month ? (
          <Figure
            node={k.gain('size-4')}
            label={`Last ${month.days} days`}
            value={signed(month.change)}
            hint={`${formatNumber(month.from)} → ${formatNumber(month.to)}`}
            tone={month.change >= 0 ? 'text-victory' : 'text-defeat'}
          />
        ) : null}
        {best ? (
          <Figure
            node={k.gain('size-4')}
            label="Best tracked day"
            value={signed(best.change)}
            hint={best.date}
            tone={k.tone}
          />
        ) : null}
      </dl>

      <p className="mt-3 text-sm text-muted">
        Tracked {tracked} {tracked === 1 ? 'day' : 'days'} &middot;{' '}
        <strong
          className={`font-semibold tabular-nums ${
            overall > 0 ? 'text-victory' : overall < 0 ? 'text-defeat' : 'text-foreground'
          }`}
        >
          {signed(overall)}
        </strong>
        {k.unit} overall
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
