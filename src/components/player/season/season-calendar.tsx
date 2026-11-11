import { formatNumber } from '@/lib/format';
import { DATE_LOCALE } from '@/lib/i18n';
import { dayFacts, dayRange, todayUtc, type SeasonDay } from '@/lib/ranked-season';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';

import { SeasonHeading } from './shared';

/**
 * The season as a calendar, one square a day: green when the day had more
 * wins than losses, red when it had fewer, deeper with more games.
 */
export function SeasonCalendar({ days, from, last, title }: { days: SeasonDay[]; from: string; last: string; title?: string }) {
  const locale = requestLocale();
  const t = getT(locale);
  const dateLocale = DATE_LOCALE[locale];
  const by = new Map(days.map((d) => [d.day, d]));
  const all = dayRange(from, last);
  const today = todayUtc();
  const max = Math.max(1, ...days.map((d) => d.games));
  // Monday first: pad the first week.
  const lead = (new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weekday = (i: number) =>
    new Date(Date.UTC(2026, 10, 9 + i)).toLocaleDateString(dateLocale, { weekday: 'narrow', timeZone: 'UTC' });
  const fmt = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const month = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString(dateLocale, { month: 'short', timeZone: 'UTC' }).replace('.', '');
  const facts = dayFacts(days);

  return (
    <section className="card p-5 sm:p-6">
      <SeasonHeading
        title={title ?? t('Season calendar')}
        aside={t('{n} of {total} days played', { n: facts.played, total: all.filter((d) => d <= today).length })}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i}>{weekday(i)}</span>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-1.5">
            {Array.from({ length: lead }, (_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {all.map((day) => {
              const d = by.get(day);
              const future = day > today;
              const games = d?.games ?? 0;
              const wins = d?.wins ?? 0;
              const tone = games === 0 ? null : wins * 2 >= games ? 'var(--victory)' : 'var(--defeat)';
              const strength = games === 0 ? 0 : 0.5 + 0.5 * Math.min(1, games / max);
              const label = future
                ? fmt(day)
                : games === 0
                  ? t('{date}: no Ranked games', { date: fmt(day) })
                  : t('{date}: {games} games, {w}–{l}', { date: fmt(day), games, w: wins, l: games - wins });
              return (
                <span
                  key={day}
                  title={label}
                  aria-label={label}
                  className={`relative grid aspect-square place-items-center rounded-md border-2 text-[10px] font-bold tabular-nums ${
                    future ? 'border-dashed border-border/70 text-muted/50' : 'border-ink text-foreground/90'
                  } ${day === today ? 'ring-2 ring-brand ring-offset-1 ring-offset-surface' : ''}`}
                  style={{
                    background: tone
                      ? `color-mix(in srgb, ${tone} ${Math.round(strength * 100)}%, var(--surface-2))`
                      : future
                        ? 'transparent'
                        : 'color-mix(in srgb, var(--surface-3) 55%, transparent)',
                  }}
                >
                  {day === from || day.endsWith('-01') ? (
                    <span className="absolute left-1 top-0.5 text-[8px] font-bold uppercase leading-none text-foreground/70">
                      {month(day)}
                    </span>
                  ) : null}
                  {Number(day.slice(8))}
                </span>
              );
            })}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-3 rounded-sm border border-ink bg-victory" />
              {t('More wins')}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-3 rounded-sm border border-ink bg-defeat" />
              {t('More losses')}
            </span>
            <span>{t('Deeper colour: more games')}</span>
          </p>
        </div>

        <dl className="grid grid-cols-2 content-start gap-3">
          <Fact label={t('Days played')} value={formatNumber(facts.played)} />
          <Fact label={t('Days in a row')} value={formatNumber(facts.longestRun)} hint={t('Longest run of days with a game')} />
          {facts.busiest ? (
            <Fact
              label={t('Busiest day')}
              value={fmt(facts.busiest.day)}
              hint={t('{games} games, {w}–{l}', { games: facts.busiest.games, w: facts.busiest.wins, l: facts.busiest.games - facts.busiest.wins })}
            />
          ) : null}
          {facts.best ? (
            <Fact
              label={t('Best day')}
              value={fmt(facts.best.day)}
              hint={t('{games} games, {w}–{l}', { games: facts.best.games, w: facts.best.wins, l: facts.best.games - facts.best.wins })}
              tone="text-victory"
            />
          ) : null}
        </dl>
      </div>
    </section>
  );
}

function Fact({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-surface-2/50 px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`label-game mt-0.5 text-2xl leading-tight ${tone ?? ''}`}>{value}</dd>
      {hint ? <dd className="mt-0.5 text-xs text-muted">{hint}</dd> : null}
    </div>
  );
}
