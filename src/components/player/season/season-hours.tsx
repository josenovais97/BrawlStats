'use client';

import { useSyncExternalStore } from 'react';

/**
 * When the games were played, in the reader's own time zone, so it is worked
 * out in the browser. The server hands over each game's time and result and
 * the texts already translated.
 */
export interface HoursLabels {
  title: string;
  aside: string;
  /** "Most games: {hour}" */
  busiest: string;
  /** "Best hour: {hour} ({rate})" */
  best: string;
  /** "{games} games, {rate} won" */
  cell: string;
  weekdays: string;
}

const noop = () => () => {};

export function SeasonHours({
  games,
  labels,
  dateLocale,
  percentStyle,
}: {
  /** [epoch seconds, 1 for a win] */
  games: [number, 0 | 1][];
  labels: HoursLabels;
  dateLocale: string;
  percentStyle: 'pre' | 'space' | 'post';
}) {
  const zone = useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'local', () => null);

  const hours = Array.from({ length: 24 }, () => ({ games: 0, wins: 0 }));
  const days = Array.from({ length: 7 }, () => ({ games: 0, wins: 0 }));
  if (zone) {
    for (const [t, win] of games) {
      const d = new Date(t * 1000);
      hours[d.getHours()].games += 1;
      hours[d.getHours()].wins += win;
      const wd = (d.getDay() + 6) % 7;
      days[wd].games += 1;
      days[wd].wins += win;
    }
  }
  const max = Math.max(1, ...hours.map((h) => h.games));
  const pct = (rate: number) => {
    const n = String(Math.round(rate * 100));
    return percentStyle === 'pre' ? `%${n}` : percentStyle === 'space' ? `${n} %` : `${n}%`;
  };
  const hourName = (h: number) => new Date(2026, 0, 1, h).toLocaleTimeString(dateLocale, { hour: 'numeric' });
  const fill = (rate: number) => (rate >= 0.55 ? 'var(--victory)' : rate < 0.45 ? 'var(--defeat)' : 'var(--brand)');
  const busiest = zone ? hours.reduce((b, h, i) => (h.games > hours[b].games ? i : b), 0) : null;
  const eligible = hours.map((h, i) => ({ ...h, i })).filter((h) => h.games >= 5);
  const best = zone && eligible.length >= 2 ? eligible.sort((a, b) => b.wins / b.games - a.wins / a.games)[0] : null;
  const weekdayName = (i: number) => new Date(2026, 10, 9 + i).toLocaleDateString(dateLocale, { weekday: 'short' });

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="display text-xl leading-none sm:text-2xl">{labels.title}</h3>
        <span className="text-xs text-muted">{labels.aside}</span>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {busiest !== null && hours[busiest].games > 0 ? (
          <span>{labels.busiest.replace('{hour}', hourName(busiest))}</span>
        ) : null}
        {best ? (
          <span className="text-victory">{labels.best.replace('{hour}', hourName(best.i)).replace('{rate}', pct(best.wins / best.games))}</span>
        ) : null}
      </div>

      <div className="mt-4 flex h-36 items-end gap-[3px]" aria-hidden={!zone}>
        {hours.map((h, i) => (
          <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
            <div
              className="rounded-t-[4px] border-2 border-b-0 border-ink transition-[height] duration-500"
              title={`${hourName(i)} · ${labels.cell.replace('{games}', String(h.games)).replace('{rate}', h.games ? pct(h.wins / h.games) : '–')}`}
              style={{
                height: h.games ? `${Math.max(6, (h.games / max) * 100)}%` : '3px',
                background: h.games ? fill(h.wins / h.games) : 'var(--surface-3)',
                borderWidth: h.games ? undefined : 0,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted">
        {[0, 6, 12, 18, 23].map((h) => (
          <span key={h}>{hourName(h)}</span>
        ))}
      </div>

      <p className="label-game mt-6 text-sm text-muted">{labels.weekdays}</p>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {days.map((d, i) => (
          <div key={i} className="rounded-lg bg-surface-2/50 px-1 py-2 text-center">
            <p className="text-[11px] text-muted">{weekdayName(i)}</p>
            <p className="label-game text-base" style={{ color: d.games ? fill(d.wins / d.games) : undefined }}>
              {d.games ? pct(d.wins / d.games) : '–'}
            </p>
            <p className="text-[10px] text-muted tabular-nums">{d.games || '\u00a0'}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
