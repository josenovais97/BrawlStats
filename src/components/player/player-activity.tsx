import { cache } from 'react';

import { BrawlerFace, brawlerName, rateTone, SeasonHeading } from '@/components/player/season/shared';
import { formatNumber, formatPercentWhole } from '@/lib/format';
import { DATE_LOCALE } from '@/lib/i18n';
import { summarizeActivity } from '@/lib/player-activity';
import { todayUtc } from '@/lib/ranked-season';
import { getPlayerActivity } from '@/lib/stats';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';
import type { BABrawler } from '@/types/brawlapi';

const DAYS = 30;

/** One read per request, shared by the Battles panel and the Brawlers grid. */
export const activityFor = cache((tag: string) => getPlayerActivity(tag, DAYS));

/** Win rate when there are enough decided games to mean something. */
const shown = (t: { wins: number; decided: number }) => (t.decided >= 5 ? t.wins / t.decided : null);

/**
 * The last 30 days in every mode (2026-11-10), for accounts the sampler
 * visits: totals, trophy and Ranked split, a bar a day, and the most played
 * brawlers. Renders nothing without data, so the Battles tab falls back to the
 * battle log alone.
 */
export async function PlayerActivity({ tag, brawlerMeta }: { tag: string; brawlerMeta: Map<number, BABrawler> }) {
  const rows = await activityFor(tag);
  if (!rows || rows.length === 0) return null;
  const locale = requestLocale();
  const t = getT(locale);
  const to = todayUtc();
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  const s = summarizeActivity(rows, from, to);
  if (s.all.battles === 0) return null;

  const fmt = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString(DATE_LOCALE[locale], { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const max = Math.max(1, ...s.days.map((d) => d.battles));
  const top = s.brawlers.slice(0, 8);
  const topMax = Math.max(1, top[0]?.battles ?? 1);
  const allRate = shown(s.all);
  const trophyRate = shown(s.trophy);
  const rankedRate = shown(s.ranked);

  return (
    <section className="card p-5 sm:p-6">
      <SeasonHeading title={t('Last 30 days')} aside={t('{n} of 30 days played', { n: s.played })} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label={t('Battles')} value={formatNumber(s.all.battles)} />
        <Tile label={t('Win rate')} value={allRate !== null ? formatPercentWhole(allRate) : '–'} tone="text-brand" />
        <Tile
          label={t('Trophy games')}
          value={formatNumber(s.trophy.battles)}
          dot="var(--brand)"
          hint={trophyRate !== null ? t('{rate} won', { rate: formatPercentWhole(trophyRate) }) : undefined}
        />
        <Tile
          label={t('Ranked games')}
          value={formatNumber(s.ranked.battles)}
          dot="var(--accent)"
          hint={rankedRate !== null ? t('{rate} won', { rate: formatPercentWhole(rankedRate) }) : undefined}
        />
        <Tile label={t('Brawlers played')} value={formatNumber(s.brawlers.length)} />
      </div>

      {/* A bar a day: trophy games under Ranked games. */}
      <div className="mt-6">
        <div className="flex h-32 items-end gap-[3px] sm:h-40" role="img" aria-label={t('Battles per day, last 30 days')}>
          {s.days.map((d) => {
            const trophy = d.battles - d.ranked;
            const dayRate = shown(d);
            const label =
              d.battles === 0
                ? t('{date}: no battles', { date: fmt(d.day) })
                : t('{date}: {n} battles, {ranked} Ranked', { date: fmt(d.day), n: d.battles, ranked: d.ranked }) +
                  (dayRate !== null ? ` · ${t('{rate} won', { rate: formatPercentWhole(dayRate) })}` : '');
            return (
              <div key={d.day} title={label} className="flex h-full flex-1 flex-col justify-end">
                {d.battles === 0 ? (
                  <div className="h-[3px] rounded-full bg-surface-3" />
                ) : (
                  <div
                    className="flex flex-col overflow-hidden rounded-t-[4px] border-2 border-b-0 border-ink"
                    style={{ height: `${Math.max(8, (d.battles / max) * 100)}%` }}
                  >
                    {d.ranked > 0 ? <div style={{ flexGrow: d.ranked, background: 'var(--accent)' }} /> : null}
                    {trophy > 0 ? <div style={{ flexGrow: trophy, background: 'var(--brand)' }} /> : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted">
          <span>{fmt(from)}</span>
          <span>{fmt(s.days[Math.floor(s.days.length / 2)].day)}</span>
          <span>{fmt(to)}</span>
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-sm border border-ink bg-brand" />
            {t('Trophy games')}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-sm border border-ink bg-accent" />
            {t('Ranked games')}
          </span>
        </p>
      </div>

      {/* The most played brawlers, with the same split. */}
      <p className="label-game mb-2 mt-6 text-base">{t('Most played')}</p>
      <ol className="grid gap-x-6 gap-y-1 md:grid-cols-2">
        {top.map((b) => {
          const r = shown(b);
          return (
            <li key={b.brawlerId} className="flex items-center gap-3 py-1.5">
              <BrawlerFace id={b.brawlerId} meta={brawlerMeta} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="label-game truncate text-base">{brawlerName(b.brawlerId, brawlerMeta)}</p>
                  <p className="shrink-0 text-[11px] text-muted tabular-nums">{t('{games} games', { games: b.battles })}</p>
                </div>
                <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-surface-3" style={{ width: `${Math.max(8, (b.battles / topMax) * 100)}%` }}>
                  {b.trophy.battles > 0 ? <div style={{ flexGrow: b.trophy.battles, background: 'var(--brand)' }} /> : null}
                  {b.ranked.battles > 0 ? <div style={{ flexGrow: b.ranked.battles, background: 'var(--accent)' }} /> : null}
                </div>
              </div>
              <span className={`display w-12 shrink-0 text-right text-xl ${r !== null ? rateTone(r) : 'text-muted'}`}>
                {r !== null ? formatPercentWhole(r) : '–'}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Tile({ label, value, tone, hint, dot }: { label: string; value: string; tone?: string; hint?: string; dot?: string }) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-surface-2/70 px-4 py-3 shadow-[inset_0_2px_0_rgb(255_255_255/0.08),0_3px_0_var(--ink)]">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {dot ? <span aria-hidden className="size-2.5 rounded-full border border-ink" style={{ background: dot }} /> : null}
        {label}
      </p>
      <p className={`display mt-0.5 text-3xl leading-none tabular-nums ${tone ?? ''}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

