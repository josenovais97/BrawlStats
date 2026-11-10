'use client';

import { ArrowRight, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';

import { useT } from '@/components/i18n/use-t';
import { NUMBER_LOCALE, type Locale } from '@/lib/i18n';
import type { TierBrawlerDetail, TierBrawlerRef, TierBrawlerSlice } from '@/lib/tier-brawler';
import { TIER_COLOR } from '@/lib/tiers';

import type { TierToolEntry } from './tier-tools';

function pct(value: number | null | undefined, locale: Locale, digits = 1): string {
  if (value === null || value === undefined) return '–';
  const n = (value * 100).toLocaleString(NUMBER_LOCALE[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return locale === 'tr' ? `%${n}` : locale === 'fr' ? `${n} %` : `${n}%`;
}

function points(edge: number, locale: Locale): string {
  const n = Math.round(edge * 1000) / 10;
  return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toLocaleString(NUMBER_LOCALE[locale], { maximumFractionDigits: 1 })}`;
}

const tone = (rate: number) => (rate >= 0.53 ? 'text-victory' : rate < 0.47 ? 'text-defeat' : 'text-foreground');

/**
 * A brawler's panel over the tier list (2026-11-10): a side sheet on a wide
 * screen, a bottom sheet on a phone. The tile's numbers show at once; the
 * rest arrives from /api/tier-brawler/[id] (`detail` is null meanwhile).
 */
export function TierDrawer({
  entry,
  detail,
  failed,
  locale,
  href,
  onClose,
}: {
  entry: TierToolEntry;
  detail: TierBrawlerDetail | null;
  failed: boolean;
  locale: Locale;
  href: string;
  onClose: () => void;
}) {
  const t = useT();
  const color = TIER_COLOR[entry.tier];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={entry.name}>
      <button type="button" aria-label={t('Close')} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border-2 border-ink bg-background shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[30rem] sm:rounded-none sm:rounded-l-3xl">
        {/* Header: the brawler large on its tier's colour. */}
        <div
          className="relative isolate overflow-hidden px-5 pb-5 pt-6"
          style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${color} 45%, var(--surface)) 0%, var(--surface) 70%)` }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full border-2 border-ink bg-surface-2/80 hover:bg-surface-3"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-end gap-4">
            <div className="relative size-28 shrink-0 sm:size-32">
              {detail?.art || entry.image ? (
                <Image
                  src={detail?.art ?? entry.image!}
                  alt=""
                  fill
                  unoptimized
                  sizes="128px"
                  className={detail?.art ? 'object-contain drop-shadow-[0_6px_0_rgb(5_10_31/0.5)]' : 'rounded-2xl border-[3px] border-ink object-cover'}
                />
              ) : null}
            </div>
            <div className="min-w-0 pb-1">
              <p className="flex items-center gap-2">
                <span className="display text-game-stroke grid size-9 place-items-center rounded-xl border-2 border-ink text-xl text-white" style={{ background: color }}>
                  {entry.tier}
                </span>
                {detail?.className ? <span className="text-xs text-muted">{t(detail.className)}</span> : null}
              </p>
              <h2 className="display text-game-stroke mt-1 truncate text-3xl capitalize leading-none sm:text-4xl">{entry.name.toLowerCase()}</h2>
              <p className="display text-game-stroke mt-1 text-2xl" style={{ color }}>
                {entry.score !== null ? entry.score.toLocaleString(NUMBER_LOCALE[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–'}
                <span className="ml-1.5 align-middle font-sans text-xs font-bold text-muted" style={{ WebkitTextStroke: 0 }}>{t('Score')}</span>
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label={t('Win rate')} value={pct(entry.winRate, locale)} />
            <Stat label={t('Pick rate')} value={pct(entry.pickRate, locale)} />
            <Stat label={t('Battles')} value={entry.games.toLocaleString(NUMBER_LOCALE[locale])} />
          </div>
        </div>

        <div className="space-y-6 px-5 pb-8 pt-5">
          {failed ? (
            <p className="text-sm text-muted">{t('Could not load the details. Try again in a moment.')}</p>
          ) : !detail ? (
            <div className="space-y-3">
              <div className="skeleton h-28 rounded-2xl" />
              <div className="skeleton h-20 rounded-2xl" />
              <div className="skeleton h-32 rounded-2xl" />
            </div>
          ) : (
            <>
              {detail.trend.filter((p) => p.winRate !== null).length >= 3 ? <Trend detail={detail} locale={locale} /> : null}

              {detail.modes.length > 0 ? (
                <Section title={t('Best modes')}>
                  <ul className="grid grid-cols-2 gap-2">
                    {detail.modes.map((m) => (
                      <li key={m.mode} className="flex items-center gap-2 rounded-xl bg-surface-2/60 px-2.5 py-2">
                        {m.modeIcon ? <Image src={m.modeIcon} alt="" width={24} height={24} unoptimized className="size-6 shrink-0" /> : null}
                        <span className="min-w-0 flex-1 truncate text-sm font-bold">{m.name}</span>
                        <span className={`label-game text-sm ${tone(m.score)}`}>{pct(m.winRate, locale, 0)}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {detail.bestMaps.length > 0 ? (
                <Section title={t('Best maps')}>
                  <MapList rows={detail.bestMaps} locale={locale} />
                </Section>
              ) : null}
              {detail.worstMaps.length > 0 ? (
                <Section title={t('Worst maps')}>
                  <MapList rows={detail.worstMaps} locale={locale} />
                </Section>
              ) : null}

              {detail.strong.length + detail.weak.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {detail.strong.length > 0 ? (
                    <Section title={t('Strong against')}>
                      <Faces rows={detail.strong} locale={locale} />
                    </Section>
                  ) : null}
                  {detail.weak.length > 0 ? (
                    <Section title={t('Weak against')}>
                      <Faces rows={detail.weak} locale={locale} />
                    </Section>
                  ) : null}
                </div>
              ) : null}
              {detail.mates.length > 0 ? (
                <Section title={t('Best with')}>
                  <Faces rows={detail.mates} locale={locale} />
                </Section>
              ) : null}

              {detail.build.starPower || detail.build.gadget || detail.build.gears.length > 0 ? (
                <Section title={t('Most used build')}>
                  <ul className="grid gap-2">
                    {[detail.build.starPower, detail.build.gadget, ...detail.build.gears]
                      .filter((p): p is NonNullable<typeof p> => p !== null)
                      .map((p, i) => (
                        <li key={`${p.name}-${i}`} className="flex items-center gap-3 rounded-xl bg-surface-2/60 px-2.5 py-2">
                          <Image src={p.icon} alt="" width={36} height={36} unoptimized className="size-9 shrink-0 object-contain" />
                          <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.name || '–'}</span>
                          <span className="text-xs tabular-nums text-muted">{pct(p.share, locale, 0)}</span>
                        </li>
                      ))}
                  </ul>
                </Section>
              ) : null}
            </>
          )}

          <Link href={href} className="btn-game flex w-full items-center justify-center gap-2 bg-brand px-4 py-2.5 text-sm text-brand-ink hover:bg-brand-strong">
            {t('Full brawler page')}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-ink bg-surface-2/70 px-3 py-2 shadow-[0_3px_0_var(--ink)]">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="display text-xl leading-none tabular-nums">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="label-game mb-2 text-base">{title}</h3>
      {children}
    </section>
  );
}

function MapList({ rows, locale }: { rows: TierBrawlerSlice[]; locale: Locale }) {
  return (
    <ul className="grid gap-2">
      {rows.map((m) => (
        <li key={`${m.mode}-${m.name}`} className="flex items-center gap-3 rounded-xl bg-surface-2/60 p-2">
          {m.image ? (
            <Image src={m.image} alt="" width={40} height={40} unoptimized className="size-10 shrink-0 rounded-lg border-2 border-ink object-cover" />
          ) : (
            <span className="size-10 shrink-0 rounded-lg bg-surface-3" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{m.name}</p>
            <p className="flex items-center gap-1 text-[11px] text-muted">
              {m.modeIcon ? <Image src={m.modeIcon} alt="" width={14} height={14} unoptimized className="size-3.5" /> : null}
              {m.modeName} · {m.games.toLocaleString(NUMBER_LOCALE[locale])}
            </p>
          </div>
          <span className={`label-game text-base ${tone(m.score)}`}>{pct(m.winRate, locale, 0)}</span>
        </li>
      ))}
    </ul>
  );
}

function Faces({ rows, locale }: { rows: TierBrawlerRef[]; locale: Locale }) {
  return (
    <ul className="grid gap-1.5">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-2.5" title={`${r.name}: ${pct(r.winRate, locale)} · ${r.games.toLocaleString(NUMBER_LOCALE[locale])}`}>
          <Image src={r.icon} alt="" width={32} height={32} unoptimized className="size-8 shrink-0 rounded-lg border-2 border-ink object-cover" />
          <span className="min-w-0 flex-1 truncate text-sm font-bold capitalize">{r.name.toLowerCase()}</span>
          <span className={`text-xs font-bold tabular-nums ${r.edge >= 0 ? 'text-victory' : 'text-defeat'}`}>{points(r.edge, locale)}</span>
        </li>
      ))}
    </ul>
  );
}

/** 30 days of adjusted win rate (line) over pick rate (bars). */
function Trend({ detail, locale }: { detail: TierBrawlerDetail; locale: Locale }) {
  const t = useT();
  const pts = detail.trend.filter((p) => p.winRate !== null) as { date: string; winRate: number; pickRate: number | null }[];
  const rates = pts.map((p) => p.winRate);
  const lo = Math.min(...rates, 0.45);
  const hi = Math.max(...rates, 0.55);
  const maxPick = Math.max(0.001, ...pts.map((p) => p.pickRate ?? 0));
  const x = (i: number) => (pts.length === 1 ? 50 : (i / (pts.length - 1)) * 100);
  const y = (v: number) => 6 + (1 - (v - lo) / (hi - lo)) * 64;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(p.winRate).toFixed(2)}`).join(' ');
  const change = rates[rates.length - 1] - rates[0];
  const fifty = y(0.5);
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="label-game text-base">{t('Last 30 days')}</h3>
        <span className={`text-xs font-bold tabular-nums ${change > 0.005 ? 'text-victory' : change < -0.005 ? 'text-defeat' : 'text-muted'}`}>
          {t('{change} win rate', { change: points(change, locale) })}
        </span>
      </div>
      <div className="relative h-36 rounded-xl bg-surface-2/50">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {pts.map((p, i) => (
            <rect
              key={p.date}
              x={x(i) - 1.2}
              width="2.4"
              y={100 - ((p.pickRate ?? 0) / maxPick) * 22}
              height={((p.pickRate ?? 0) / maxPick) * 22}
              fill="var(--accent)"
              opacity="0.45"
            />
          ))}
          {fifty > 0 && fifty < 72 ? (
            <line x1="0" x2="100" y1={fifty} y2={fifty} stroke="var(--border-strong)" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ) : null}
          <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute right-2 top-1.5 rounded-md border-2 border-ink bg-brand px-1.5 text-[11px] font-bold text-brand-ink tabular-nums">
          {pct(rates[rates.length - 1], locale)}
        </span>
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-brand" />
          {t('Win rate')}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-accent/60" />
          {t('Pick rate')}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0 w-4 border-t border-dashed border-border-strong" />
          {pct(0.5, locale, 0)}
        </span>
      </p>
    </section>
  );
}
