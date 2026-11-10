import Image from 'next/image';

import { rankedLeagueIconUrl } from '@/lib/brawlapi';
import { formatNumber } from '@/lib/format';
import { RANK_ELO_FLOORS } from '@/lib/ranked-elo';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';
import { DATE_LOCALE } from '@/lib/i18n';

import { rankLabel, SeasonHeading } from './shared';

/** The eight leagues and where each starts. Pro is drawn 2,000 elo wide. */
const LEAGUES = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'MYTHIC', 'LEGENDARY', 'MASTERS', 'PRO'].map((league) => ({
  league,
  floor: RANK_ELO_FLOORS.find(([n]) => n.startsWith(league))![1],
}));

/** 0-1 along the road: each league an equal share, linear inside it. */
function roadPosition(elo: number): number {
  let i = 0;
  for (let j = 0; j < LEAGUES.length; j++) if (elo >= LEAGUES[j].floor) i = j;
  const floor = LEAGUES[i].floor;
  const ceiling = LEAGUES[i + 1]?.floor ?? floor + 2000;
  const inside = Math.min(1, Math.max(0, (elo - floor) / (ceiling - floor)));
  return (i + inside) / LEAGUES.length;
}

function rankAt(elo: number): string {
  let name = RANK_ELO_FLOORS[0][0];
  for (const [n, floor] of RANK_ELO_FLOORS) if (elo >= floor) name = n;
  return name;
}

interface Marker {
  key: string;
  label: string;
  elo: number;
  color: string;
}

export function RankRoad({
  now,
  seasonBest,
  allTime,
  points,
  from,
  to,
}: {
  now: number | null;
  seasonBest: number | null;
  allTime: number | null;
  /** Daily elo readings this season, oldest first, today's live elo included. */
  points: { day: string; elo: number }[];
  /** Season start and last day (YYYY-MM-DD). */
  from: string;
  to: string;
}) {
  const locale = requestLocale();
  const t = getT(locale);
  const markers: Marker[] = [
    allTime ? { key: 'all', label: t('All-time best'), elo: allTime, color: 'var(--accent-2)' } : null,
    seasonBest ? { key: 'season', label: t('Season best'), elo: seasonBest, color: '#ffffff' } : null,
    now ? { key: 'now', label: t('Now'), elo: now, color: 'var(--brand)' } : null,
  ].filter((m): m is Marker => m !== null);
  if (markers.length === 0) return null;
  const fill = now ? roadPosition(now) : 0;

  return (
    <section className="card p-5 sm:p-6">
      <SeasonHeading title={t('Rank road')} aside={now ? t('{v} elo', { v: formatNumber(now) }) : null} />

      {/* The leagues as a track, filled to today's elo, with pins for the bests. */}
      <div className="relative mt-6 px-1">
        <div className="relative h-4 overflow-hidden rounded-full border-2 border-ink bg-surface-3 shadow-[inset_0_2px_0_rgb(0_0_0/0.3)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#c9773a] via-brand to-[#ff6bd0]"
            style={{ width: `${fill * 100}%` }}
          />
        </div>
        {markers.map((m) => (
          <span
            key={m.key}
            aria-hidden
            className="absolute -top-3 size-0 -translate-x-1/2 border-x-[7px] border-t-[10px] border-x-transparent drop-shadow-[0_2px_0_var(--ink)]"
            style={{ left: `calc(${roadPosition(m.elo) * 100}% + 0.25rem)`, borderTopColor: m.color }}
          />
        ))}
        <ol className="mt-3 grid grid-cols-8 gap-0.5">
          {LEAGUES.map(({ league, floor }) => {
            const reached = now !== null && now >= floor;
            const icon = rankedLeagueIconUrl(league);
            return (
              <li key={league} className="flex flex-col items-center gap-1 text-center">
                {icon ? (
                  <Image
                    src={icon}
                    alt=""
                    width={40}
                    height={40}
                    unoptimized
                    className={`size-7 object-contain sm:size-10 ${reached ? '' : 'opacity-35 grayscale'}`}
                  />
                ) : null}
                <span className={`hidden text-[11px] leading-tight sm:block ${reached ? 'text-foreground' : 'text-muted/70'}`}>
                  {rankLabel(league, t)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <ul className="mt-5 grid gap-2 sm:grid-cols-3">
        {[...markers].reverse().map((m) => (
          <li key={m.key} className="flex items-center gap-3 rounded-xl bg-surface-2/50 px-3 py-2.5">
            <span aria-hidden className="size-3 shrink-0 rounded-full border-2 border-ink" style={{ background: m.color }} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted">{m.label}</span>
              <span className="label-game block truncate text-base">{rankLabel(rankAt(m.elo), t)}</span>
            </span>
            <span className="text-sm font-bold tabular-nums">{formatNumber(m.elo)}</span>
          </li>
        ))}
      </ul>

      {points.length >= 2 ? <EloChart points={points} from={from} to={to} dateLocale={DATE_LOCALE[locale]} title={t('Elo this season')} /> : null}
    </section>
  );
}

/**
 * Daily elo across the season, with the rank floors it crosses drawn in.
 * Readings exist for the days the profile was opened, so the line joins
 * those days. Lines in a stretched SVG, dots and labels in HTML on top, so
 * the text stays the same size on a phone and on a desktop.
 */
function EloChart({
  points,
  from,
  to,
  dateLocale,
  title,
}: {
  points: { day: string; elo: number }[];
  from: string;
  to: string;
  dateLocale: string;
  title: string;
}) {
  const t = getT(requestLocale());
  const start = Date.parse(`${from}T00:00:00Z`);
  const span = Math.max(1, Date.parse(`${to}T00:00:00Z`) - start);
  const elos = points.map((p) => p.elo);
  const lo = Math.max(0, Math.min(...elos) - 150);
  const hi = Math.max(...elos) + 150;
  // Percentages of the plot area; 8% kept clear top and bottom.
  const x = (day: string) => ((Date.parse(`${day}T00:00:00Z`) - start) / span) * 100;
  const y = (elo: number) => 8 + (1 - (elo - lo) / (hi - lo)) * 84;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(2)},${y(p.elo).toFixed(2)}`).join(' ');
  const area = `${line} L${x(points[points.length - 1].day).toFixed(2)},100 L${x(points[0].day).toFixed(2)},100 Z`;
  const floors = RANK_ELO_FLOORS.filter(([, f]) => f > lo && f < hi);
  const fmt = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const first = points[0];
  const last = points[points.length - 1];
  const change = last.elo - first.elo;

  return (
    <figure className="mt-6 border-t border-border/70 pt-5">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="label-game text-base">{title}</span>
        <span className={`text-sm font-bold tabular-nums ${change > 0 ? 'text-victory' : change < 0 ? 'text-defeat' : 'text-muted'}`}>
          {t('{change} since {date}', { change: `${change > 0 ? '+' : change < 0 ? '−' : '±'}${formatNumber(Math.abs(change))}`, date: fmt(first.day) })}
        </span>
      </figcaption>
      <div className="relative h-44 sm:h-56" role="img" aria-label={title}>
        <div className="absolute inset-y-0 left-0 right-24 sm:right-28">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <linearGradient id="elo-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {floors.map(([name, f]) => (
              <line key={name} x1="0" x2="100" y1={y(f)} y2={y(f)} stroke="var(--border-strong)" strokeDasharray="4 5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} fill="url(#elo-area)" />
            <path d={line} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {points.map((p) => (
            <span
              key={p.day}
              title={`${fmt(p.day)}: ${formatNumber(p.elo)}`}
              className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-brand"
              style={{ left: `${x(p.day)}%`, top: `${y(p.elo)}%` }}
            />
          ))}
          <span
            className="absolute -translate-y-[160%] rounded-md border-2 border-ink bg-brand px-1.5 text-xs font-bold text-brand-ink tabular-nums"
            style={{ left: `min(${x(last.day)}%, calc(100% - 3rem))`, top: `${y(last.elo)}%` }}
          >
            {formatNumber(last.elo)}
          </span>
        </div>
        {floors.map(([name, f]) => (
          <span key={name} className="absolute right-0 w-24 -translate-y-1/2 truncate pl-2 text-[11px] text-muted sm:w-28" style={{ top: `${y(f)}%` }}>
            {rankLabel(name, t)}
          </span>
        ))}
      </div>
      <div className="mr-24 mt-1.5 flex justify-between text-[11px] text-muted sm:mr-28">
        <span>{fmt(from)}</span>
        <span>{fmt(to)}</span>
      </div>
    </figure>
  );
}
