'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

import { panelBracket } from '@/components/bubble/bracket-data';
import { usePanelI18n } from '@/components/bubble/panel-i18n';
import type { PanelMode } from '@/components/bubble/panel-tiers';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';

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

  const openId = open?.brawlerId ?? null;
  const loaded = openId !== null && builds[openId] !== undefined;

  useEffect(() => {
    if (openId === null) return;
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [openId, loaded]);

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

export function BuildCard({
  ref,
  entry,
  build,
  modes,
  onPickBrawler,
  onPickMap,
}: {
  ref: React.Ref<HTMLElement>;
  entry: BuildBrawler;
  build: BuildResponse | 'error' | undefined;
  /** With the panel's modes, the card adds who counters it and its best maps. */
  modes?: PanelMode[];
  onPickBrawler?: (brawlerId: number) => void;
  onPickMap?: (modeKey: string, mapName: string) => void;
}) {
  const { t, name, lang } = usePanelI18n();
  return (
    <section ref={ref} className="bz-panel mt-2 overflow-hidden scroll-mt-2">
      <header className="flex items-center gap-2 border-b border-border px-2.5 py-2">
        <Image
          src={entry.imageUrl}
          alt=""
          width={28}
          height={28}
          className="size-7 shrink-0 rounded-md bg-surface-2"
          unoptimized
        />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{name(entry.brawlerName)}</span>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">
          {t('build.mostOwned')}
        </span>
      </header>

      {build === undefined ? (
        <p className="px-2.5 py-3 text-xs text-muted">{t('build.loading')}</p>
      ) : build === 'error' || build.owners === 0 ? (
        <p className="px-2.5 py-3 text-xs leading-relaxed text-muted">
          {t('build.noOwners')}
        </p>
      ) : (
        <div className="space-y-1.5 p-2.5">
          {/* The game's own words for the three kinds, from its files. */}
          {build.starPower ? <BuildRow item={build.starPower} kind={name('Star Power')} /> : null}
          {build.gadget ? <BuildRow item={build.gadget} kind={name('Gadget')} /> : null}
          {build.gears.map((gear) => (
            <BuildRow key={gear.itemId} item={gear} kind={name('Gear')} />
          ))}

          {build.gears.length === 0 && !build.starPower && !build.gadget ? (
            <p className="text-xs leading-relaxed text-muted">
              {t('build.nothing')}
            </p>
          ) : null}

          {/*
            The caveat has to travel with the numbers.

            Owners tend to hold both star powers and both gadgets, so those two
            rows usually sit near 50% — which is the honest reading of a pair
            everybody owns, not a recommendation. The share is printed rather
            than the row being hidden, so a tie looks like a tie. Gears are the
            genuine choice: two from nineteen, paid for in coins.
          */}
          <p className="pt-1 text-[10px] leading-relaxed text-muted">
            {t('build.caveat', { n: build.owners.toLocaleString(lang) })}
          </p>
        </div>
      )}

      {modes ? <BrawlerExtras id={entry.brawlerId} modes={modes} onPickBrawler={onPickBrawler} onPickMap={onPickMap} /> : null}
    </section>
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
        const top = d.counters.slice(0, 3);
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
        .filter((x): x is NonNullable<typeof x> => x !== null)
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

