'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

import { panelBracket } from '@/components/bubble/bracket-data';
import { usePanelI18n } from '@/components/bubble/panel-i18n';
import type { PanelMode } from '@/components/bubble/panel-tiers';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';
import type { TierBrawlerDetail, TierBrawlerRef } from '@/lib/tier-brawler';
import { TIER_COLOR } from '@/lib/tiers';
import type { Tier } from '@/types/stats';

/**
 * A brawler's most-owned build, as a card under whatever was tapped.
 *
 * Shared by the Meta tab and Team comp: tap a brawler in a tier strip, a map
 * pick or a trio, and the same card opens with the same numbers. Fetched per
 * brawler rather than shipped with the page, and cached for the life of the
 * panel, because the same few names get tapped again and again in one draft.
 */

/** What the card needs to name the brawler it is about. */
export interface BuildBrawler {
  brawlerId: number;
  brawlerName: string;
  imageUrl: string;
}

interface BuildItem {
  itemId: number;
  name: string;
  imageUrl: string | null;
  share: number;
}

interface BuildResponse {
  brawlerId: number;
  owners: number;
  gears: BuildItem[];
  starPower: BuildItem | null;
  gadget: BuildItem | null;
}

/**
 * Which brawler's build is open, its fetched build, and a ref that brings the
 * card into view.
 *
 * The card renders under everything else, which in a 375dp-tall landscape
 * window is well below the fold: a tap that lit a ring and showed nothing
 * looked like a tap that did nothing. So it scrolls into view on open, and
 * again once the fetch turns a one-line placeholder into the full card.
 */
export function useBuildCard<T extends BuildBrawler>() {
  const [open, setOpen] = useState<T | null>(null);
  const [builds, setBuilds] = useState<Record<number, BuildResponse | 'error'>>({});
  const cardRef = useRef<HTMLElement | null>(null);



  const toggle = (entry: T) => {
    setOpen((prev) => (prev?.brawlerId === entry.brawlerId ? null : entry));
    if (builds[entry.brawlerId]) return;

    fetch(`/api/v1/brawler-build/${entry.brawlerId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: BuildResponse) => setBuilds((prev) => ({ ...prev, [entry.brawlerId]: data })))
      .catch(() => setBuilds((prev) => ({ ...prev, [entry.brawlerId]: 'error' })));
  };

  return {
    open,
    build: open ? builds[open.brawlerId] : undefined,
    cardRef,
    toggle,
    close: () => setOpen(null),
  };
}

/*
 * The brawler sheet (2026-11-10). Was a card appended under the whole tier
 * list, found by scrolling past everything mid-draft; now a sheet that slides
 * up over the panel where you tapped. Build and "countered by" at your rank as
 * before, plus strong against, best with and a 30-day line from the tier
 * list's /api/tier-brawler, and whether you own it.
 */
export function BuildCard({
  ref,
  entry,
  build,
  modes,
  onPickBrawler,
  onPickMap,
  onClose,
}: {
  ref: React.Ref<HTMLElement>;
  entry: BuildBrawler & { metaScore?: number | null; tier?: Tier };
  build: BuildResponse | 'error' | undefined;
  modes?: PanelMode[];
  onPickBrawler?: (brawlerId: number) => void;
  onPickMap?: (modeKey: string, mapName: string) => void;
  onClose?: () => void;
}) {
  const { t, name, lang } = usePanelI18n();
  const account = useBubbleAccount();
  const owned = account.owned ? (account.owned.get(entry.brawlerId) ?? null) : undefined;
  const rankedModes = useMemo(() => (modes ?? []).map((m) => m.key).filter((k): k is string => Boolean(k)), [modes]);
  const detail = useTierDetail(entry.brawlerId, rankedModes);
  const color = entry.tier ? TIER_COLOR[entry.tier] : 'var(--brand)';
  const portraits = useMemo(
    () => new Map((modes?.find((m) => m.key === null)?.entries ?? []).map((e) => [e.brawlerId, e])),
    [modes],
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const counterIt = () => {
    const w = window as unknown as { __bzPendingCounter?: number; __bzOpenCounter?: (id: number) => void; __bzOpenTab?: (tab: string) => void };
    w.__bzPendingCounter = entry.brawlerId;
    onClose?.();
    w.__bzOpenTab?.('counters');
    w.__bzOpenCounter?.(entry.brawlerId);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={name(entry.brawlerName)}>
      <button type="button" aria-label={t('sheet.close')} onClick={onClose} className="absolute inset-0 bg-black/60" />
      <section
        ref={ref}
        className="bz-sheet absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border-2 border-b-0 border-ink bg-background shadow-2xl"
      >
        {/* The brawler large on its tier's colour. */}
        <header
          className="relative isolate overflow-hidden px-3.5 pb-3 pt-4"
          style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${color} 42%, var(--surface)) 0%, var(--surface) 75%)` }}
        >
          <span aria-hidden className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-white/30" />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('sheet.close')}
            className="absolute right-2.5 top-2.5 z-10 grid size-8 place-items-center rounded-full border-2 border-ink bg-surface-2/80 text-sm font-black"
          >
            ✕
          </button>
          <div className="flex items-end gap-3">
            <div className="relative size-20 shrink-0">
              <Image
                src={detail?.art ?? entry.imageUrl}
                alt=""
                fill
                sizes="80px"
                unoptimized
                className={detail?.art ? 'object-contain drop-shadow-[0_5px_0_rgb(5_10_31/0.5)]' : 'rounded-xl border-2 border-ink object-cover'}
              />
            </div>
            <div className="min-w-0 pb-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {entry.tier ? (
                  <span className="display grid size-7 place-items-center rounded-lg border-2 border-ink text-base text-white" style={{ background: color }}>
                    {entry.tier}
                  </span>
                ) : null}
                {typeof entry.metaScore === 'number' ? (
                  <span className="display text-lg" style={{ color }}>
                    {entry.metaScore.toFixed(1)}
                  </span>
                ) : null}
                {owned === null ? (
                  <span className="rounded-full border border-defeat/50 bg-defeat/15 px-2 py-0.5 text-[10px] font-bold text-defeat">{t('sheet.notOwned')}</span>
                ) : owned ? (
                  <span className="rounded-full border border-victory/50 bg-victory/15 px-2 py-0.5 text-[10px] font-bold text-victory">
                    {t('sheet.owned', { n: owned.power })}
                    {owned.hypercharge ? ' ⚡' : ''}
                  </span>
                ) : null}
              </div>
              <h2 className="display mt-0.5 truncate text-2xl leading-none">{name(entry.brawlerName)}</h2>
            </div>
          </div>
        </header>

        <div className="space-y-3.5 px-3.5 pb-5 pt-3">
          {modes ? <BrawlerExtras id={entry.brawlerId} modes={modes} onPickBrawler={onPickBrawler} onPickMap={onPickMap} /> : null}

          {detail && detail.strong.length > 0 ? (
            <Faces title={t('sheet.strongAgainst')} rows={detail.strong.slice(0, 4)} portraits={portraits} onPick={onPickBrawler} positive />
          ) : null}
          {detail && detail.mates.length > 0 ? (
            <Faces title={t('sheet.bestWith')} rows={detail.mates.slice(0, 4)} portraits={portraits} onPick={onPickBrawler} positive />
          ) : null}

          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">{t('build.mostOwned')}</p>
            {build === undefined ? (
              <p className="text-xs text-muted">{t('build.loading')}</p>
            ) : build === 'error' || build.owners === 0 ? (
              <p className="text-xs leading-relaxed text-muted">{t('build.noOwners')}</p>
            ) : (
              <div className="grid gap-1.5 rounded-xl bg-surface-2/50 p-2">
                {build.starPower ? <BuildRow item={build.starPower} kind={name('Star Power')} /> : null}
                {build.gadget ? <BuildRow item={build.gadget} kind={name('Gadget')} /> : null}
                {build.gears.map((gear) => (
                  <BuildRow key={gear.itemId} item={gear} kind={name('Gear')} />
                ))}
                {build.gears.length === 0 && !build.starPower && !build.gadget ? (
                  <p className="text-xs leading-relaxed text-muted">{t('build.nothing')}</p>
                ) : (
                  <p className="pt-0.5 text-[10px] leading-relaxed text-muted">{t('build.caveat', { n: build.owners.toLocaleString(lang) })}</p>
                )}
              </div>
            )}
          </div>

          {detail ? <MiniTrend points={detail.trend} title={t('sheet.trend')} /> : null}

          <button type="button" onClick={counterIt} className="btn-game flex w-full items-center justify-center gap-2 bg-brand px-3 py-2 text-sm text-brand-ink">
            {t('sheet.counterIt')}
          </button>
        </div>
      </section>
    </div>
  );
}

const detailCache = new Map<string, TierBrawlerDetail | null>();

/** The tier list's panel data for one brawler, cached for the panel's life. */
function useTierDetail(id: number, modes: string[]): TierBrawlerDetail | null {
  const key = `${id}|${modes.join(',')}`;
  const [, bump] = useState(0);
  useEffect(() => {
    if (detailCache.has(key)) return;
    const controller = new AbortController();
    fetch(`/api/tier-brawler/${id}${modes.length ? `?modes=${modes.join(',')}` : ''}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<TierBrawlerDetail>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        detailCache.set(key, d);
        bump((n) => n + 1);
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') {
          detailCache.set(key, null);
          bump((n) => n + 1);
        }
      });
    return () => controller.abort();
  }, [id, key, modes]);
  return detailCache.get(key) ?? null;
}

function Faces({
  title,
  rows,
  portraits,
  onPick,
  positive,
}: {
  title: string;
  rows: TierBrawlerRef[];
  portraits: Map<number, PanelMode['entries'][number]>;
  onPick?: (brawlerId: number) => void;
  positive?: boolean;
}) {
  const { name } = usePanelI18n();
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">{title}</p>
      <ul className="grid grid-cols-4 gap-1.5">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => (portraits.has(r.id) ? onPick?.(r.id) : undefined)}
              className="flex w-full flex-col items-center gap-0.5 rounded-xl bg-surface-2/60 px-1 py-1.5"
            >
              <Image src={portraits.get(r.id)?.imageUrl ?? r.icon} alt="" width={36} height={36} unoptimized className="size-9 rounded-lg border-2 border-ink object-cover" />
              <span className="w-full truncate text-center text-[10px] font-bold leading-tight">{name(r.name)}</span>
              <span className={`text-[10px] font-black tabular-nums leading-none ${positive ? 'text-victory' : 'text-defeat'}`}>
                {r.edge >= 0 ? '+' : '−'}
                {Math.abs(Math.round(r.edge * 100))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 30 days of adjusted win rate as one line, with today's number. */
function MiniTrend({ points, title }: { points: TierBrawlerDetail['trend']; title: string }) {
  const pts = points.filter((p): p is { date: string; winRate: number; pickRate: number | null } => p.winRate !== null);
  if (pts.length < 3) return null;
  const v = pts.map((p) => p.winRate);
  const lo = Math.min(...v, 0.46);
  const hi = Math.max(...v, 0.54);
  const d = v.map((x, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * 100).toFixed(1)},${(4 + (1 - (x - lo) / (hi - lo)) * 32).toFixed(1)}`).join(' ');
  const change = v[v.length - 1] - v[0];
  const color = change > 0.005 ? 'var(--victory)' : change < -0.005 ? 'var(--defeat)' : 'var(--brand)';
  return (
    <div>
      <p className="mb-1 flex items-baseline justify-between text-[10px] font-bold uppercase tracking-wide text-muted">
        <span>{title}</span>
        <span className="font-black tabular-nums" style={{ color }}>
          {(v[v.length - 1] * 100).toFixed(1)}% · {change >= 0 ? '+' : '−'}
          {Math.abs(change * 100).toFixed(1)}
        </span>
      </p>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-12 w-full rounded-xl bg-surface-2/50">
        <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

interface Counter {
  brawlerId: number;
  winRate: number;
  edge: number;
  games: number;
}

/** Counters per brawler and rank, for the life of the panel. */
const countersCache = new Map<string, Counter[]>();

/**
 * Everything else about a pick, under its build (owner, 2026-11-06): the
 * three brawlers that beat it at your rank, and the Ranked maps where it
 * ranks highest right now. The maps come from the lists the panel already
 * holds, so only the counters cost a request, and only once per brawler.
 * Tapping a counter opens its card; tapping a map opens that map's list.
 */
function BrawlerExtras({
  id,
  modes,
  onPickBrawler,
  onPickMap,
}: {
  id: number;
  modes: PanelMode[];
  onPickBrawler?: (brawlerId: number) => void;
  onPickMap?: (modeKey: string, mapName: string) => void;
}) {
  const { t, name } = usePanelI18n();
  const ownRank = useBubbleAccount().rankName;
  const [counters, setCounters] = useState<Counter[] | null>(null);

  useEffect(() => {
    const rank = panelBracket(ownRank);
    const key = `${id}|${rank ?? ''}`;
    const hit = countersCache.get(key);
    if (hit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCounters(hit);
      return;
    }
    setCounters(null);
    const params = new URLSearchParams({ brawler: String(id) });
    if (rank) params.set('rank', rank);
    const controller = new AbortController();
    fetch(`/api/v1/counters?${params}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { counters: Counter[] }) => {
        // The three strongest counters, shown by win rate (the only number on the chip).
        const top = d.counters.slice(0, 3).sort((a, b) => b.winRate - a.winRate);
        countersCache.set(key, top);
        setCounters(top);
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setCounters([]);
      });
    return () => controller.abort();
  }, [id, ownRank]);

  const portraits = useMemo(
    () => new Map((modes.find((m) => m.key === null)?.entries ?? []).map((e) => [e.brawlerId, e])),
    [modes],
  );
  const bestMaps = useMemo(
    () =>
      modes
        .filter((m) => m.key !== null)
        .flatMap((m) =>
          m.maps.map((map) => {
            const order = [...map.picks].sort((a, b) => b.score - a.score);
            const at = order.findIndex((p) => p.brawlerId === id);
            return at < 0 ? null : { modeKey: m.key as string, icon: m.icon, mapName: map.mapName, place: at + 1, score: order[at].score };
          }),
        )
        // A #18 is not a best map: top ten on the map only.
        .filter((x): x is NonNullable<typeof x> => x !== null && x.place <= 10)
        .sort((a, b) => a.place - b.place || b.score - a.score)
        .slice(0, 3),
    [modes, id],
  );

  if ((counters === null || counters.length === 0) && bestMaps.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-border p-2.5">
      {counters && counters.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">{t('card.counteredBy')}</p>
          <ul className="flex flex-wrap gap-1">
            {counters.map((c) => {
              const b = portraits.get(c.brawlerId);
              return (
                <li key={c.brawlerId}>
                  <button
                    type="button"
                    onClick={() => onPickBrawler?.(c.brawlerId)}
                    className="flex items-center gap-1 rounded bg-surface-2/70 py-0.5 pe-1.5 ps-0.5"
                  >
                    {b ? <Image src={b.imageUrl} alt="" width={22} height={22} className="size-[22px] rounded bg-surface-2" unoptimized /> : null}
                    <span className="text-[10px] font-bold leading-none">{b ? name(b.brawlerName) : c.brawlerId}</span>
                    <span className="text-[10px] font-black tabular-nums leading-none text-victory">{(c.winRate * 100).toFixed(0)}%</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {bestMaps.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">{t('card.bestMaps')}</p>
          <ul className="flex flex-wrap gap-1">
            {bestMaps.map((m) => (
              <li key={`${m.modeKey}|${m.mapName}`}>
                <button
                  type="button"
                  onClick={() => onPickMap?.(m.modeKey, m.mapName)}
                  className="flex items-center gap-1 rounded bg-surface-2/70 px-1.5 py-0.5 text-[10px] leading-none"
                >
                  {m.icon ? <Image src={m.icon} alt="" width={14} height={14} className="size-3.5 object-contain" unoptimized /> : null}
                  <span className="font-black tabular-nums text-brand">#{m.place}</span>
                  <span className="font-semibold">{name(m.mapName)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function BuildRow({ item, kind }: { item: BuildItem; kind: string }) {
  const { name } = usePanelI18n();
  return (
    <div className="flex items-center gap-2">
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt=""
          width={24}
          height={24}
          className="size-6 shrink-0"
          unoptimized
        />
      ) : (
        <span className="size-6 shrink-0 rounded bg-surface-2" />
      )}
      <span className="min-w-0 flex-1">
        {/* The official catalogue publishes gear names in caps ("DAMAGE"),
            which reads as shouting next to sentence-case ability names. */}
        <span className="block truncate text-xs font-semibold">{name(item.name)}</span>
        <span className="block text-[10px] text-muted">{kind}</span>
      </span>
      <span className="shrink-0 text-xs font-bold tabular-nums text-brand">
        {Math.round(item.share * 100)}%
      </span>
    </div>
  );
}

