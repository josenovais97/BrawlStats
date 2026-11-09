'use client';

import { Search } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { panelBracket } from '@/components/bubble/bracket-data';
import { recall } from '@/components/bubble/panel-chips';
import type { DraftBrawler } from '@/components/bubble/panel-draft';
import { usePanelI18n } from '@/components/bubble/panel-i18n';
import type { PanelMode } from '@/components/bubble/panel-tiers';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';
import { panelTrack } from '@/lib/panel-telemetry';
import { slugify } from '@/lib/slugs';
import { TIER_COLOR } from '@/lib/tiers';
import type { Tier } from '@/types/stats';

/**
 * The Counters tab (2026-11-06): tap any brawler, see what beats it.
 *
 * Asked for by the owner in place of last-pick advice: the question players
 * actually bring to a draft is "they took X, what do I answer with?", and the
 * draft tab only answers it once X is on the board. Here it is one tap from
 * anywhere. The grid opens on the current Ranked top brawlers (the ones you
 * will meet), with search and the whole roster a tap away; the answer card
 * sits above the grid so it is on screen without scrolling.
 *
 * Same measurement as the draft tab's counters and the site's counters pages
 * (/api/v1/counters): at your rank when it has enough battles, every rank's
 * otherwise, and it says which.
 */
type LocalBrawler = DraftBrawler & { localName: string };

interface Counter {
  brawlerId: number;
  winRate: number;
  edge: number;
  games: number;
}

/** The grid's first screen: the brawlers you will actually face. */
const TOP = 24;

/** The site's language prefix for a panel language, where the site has it. */
export function sitePrefix(lang: string): string {
  const base = lang.toLowerCase().split('-')[0];
  return ['es', 'pt', 'tr', 'de', 'ru', 'fr'].includes(base) ? `/${base}` : '';
}

export function PanelCounters({ modes, roster }: { modes: PanelMode[]; roster: DraftBrawler[] }) {
  const { t, name, lang } = usePanelI18n();
  const ownRank = useBubbleAccount().rankName;
  const [selected, setSelected] = useState<number | null>(null);
  const [everyone, setEveryone] = useState(false);
  const [query, setQuery] = useState('');
  // The map chosen on any tab (shared in storage), so counters can be for it.
  const [mapName, setMapName] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMapName(recall().map);
  }, []);

  const byId = useMemo(
    () => new Map<number, LocalBrawler>(roster.map((b) => [b.brawlerId, { ...b, localName: name(b.brawlerName) }])),
    [roster, name],
  );
  // Meta order and tier from the combined Ranked list the Meta tab draws.
  const entries = useMemo(() => modes.find((m) => m.key === null)?.entries ?? [], [modes]);
  const tierOf = useMemo(() => new Map<number, Tier>(entries.map((e) => [e.brawlerId, e.tier])), [entries]);

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(lang);
    if (q) {
      return [...byId.values()]
        .filter((b) => b.localName.toLocaleLowerCase(lang).includes(q) || b.brawlerName.toLowerCase().includes(q))
        .sort((a, b) => a.localName.localeCompare(b.localName, lang));
    }
    if (everyone) return [...byId.values()].sort((a, b) => a.localName.localeCompare(b.localName, lang));
    const ranked = [...entries]
      .sort((a, b) => (b.metaScore ?? -1) - (a.metaScore ?? -1))
      .map((e) => byId.get(e.brawlerId))
      .filter((b): b is LocalBrawler => Boolean(b));
    return ranked.slice(0, TOP);
  }, [byId, entries, everyone, query, lang]);

  const choose = (id: number) => {
    setSelected(id);
    panelTrack('panel_counters', { brawler: byId.get(id)?.brawlerName ?? String(id) });
  };

  /*
   * The app's widgets (1.40): tapping a brawler there opens the bubble on this
   * tab with that brawler's counters. The app sets a pending id before the
   * tab mounts, or calls the hook when it is already showing.
   */
  useEffect(() => {
    const w = window as unknown as { __bzPendingCounter?: number | null; __bzOpenCounter?: (id: number) => void };
    w.__bzOpenCounter = (id: number) => {
      if (Number.isInteger(id) && id > 0) setSelected(id);
    };
    const pending = w.__bzPendingCounter;
    if (typeof pending === 'number' && pending > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(pending);
      w.__bzPendingCounter = null;
    }
    return () => {
      delete w.__bzOpenCounter;
    };
  }, []);

  return (
    <div className="space-y-2">
      {selected !== null ? (
        <CounterCard id={selected} ownRank={ownRank} byId={byId} tier={tierOf.get(selected) ?? null} lang={lang} onPick={choose} mapName={mapName} onAllMaps={() => setMapName(null)} />
      ) : (
        <p className="px-2 text-[11px] leading-snug text-muted">{t('chooser.counters')}</p>
      )}

      <div className="bz-panel space-y-1.5 p-1.5">
        <div className="flex items-center gap-1.5">
          <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg bg-surface-2/70 px-2 py-1">
            <Search className="size-3.5 shrink-0 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('counters.search')}
              className="w-full min-w-0 bg-transparent text-[11px] outline-none placeholder:text-muted"
            />
          </label>
          <button
            type="button"
            onClick={() => setEveryone((v) => !v)}
            aria-pressed={everyone}
            className={`shrink-0 px-2 py-1 text-[11px] leading-tight ${everyone ? 'bz-chip-on' : 'bz-chip'}`}
          >
            {t('draft.everyone')}
          </button>
        </div>

        {shown.length === 0 ? (
          <p className="px-1 py-2 text-center text-[11px] text-muted">{t('draft.noName')}</p>
        ) : (
          <ul className="grid grid-cols-8 gap-1">
            {shown.map((b) => {
              const on = b.brawlerId === selected;
              return (
                <li key={b.brawlerId}>
                  <button
                    type="button"
                    onClick={() => choose(b.brawlerId)}
                    aria-pressed={on}
                    title={b.localName}
                    className={`flex w-full flex-col items-center gap-0.5 rounded-md p-0.5 ${on ? 'bg-brand/25 ring-2 ring-brand' : ''}`}
                  >
                    <Image
                      src={b.imageUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="aspect-square w-full rounded bg-surface-2"
                      loading="lazy"
                      unoptimized
                    />
                    <span className="w-full truncate text-center text-[8px] font-bold leading-none">{b.localName}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * The answer: the brawler, then what beats it, best first, each with its win
 * rate in the matchup, how far that is above what the two would normally
 * score, and a bar for that margin. Tapping a counter opens its own card, so
 * "what beats the answer?" is one more tap.
 */
function CounterCard({
  id,
  ownRank,
  byId,
  tier,
  lang,
  onPick,
  mapName,
  onAllMaps,
}: {
  id: number;
  ownRank: string | null;
  byId: Map<number, LocalBrawler>;
  tier: Tier | null;
  lang: string;
  onPick: (id: number) => void;
  mapName: string | null;
  onAllMaps: () => void;
}) {
  const { t, name } = usePanelI18n();
  const [data, setData] = useState<{ counters: Counter[]; allRanks: boolean; map: string | null; mapThin: boolean } | null>(null);
  const brawler = byId.get(id);

  useEffect(() => {
    const params = new URLSearchParams({ brawler: String(id) });
    const rank = panelBracket(ownRank);
    if (rank) params.set('rank', rank);
    if (mapName) params.set('map', mapName);
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    fetch(`/api/v1/counters?${params}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { counters: Counter[]; allRanks: boolean; map?: string | null; mapThin?: boolean }) =>
        setData({
          counters: d.counters,
          // Map counters span every rank by design; only the rank answer's fallback is worth a note.
          allRanks: !d.map && d.allRanks && rank !== null,
          map: d.map ?? null,
          mapThin: Boolean(d.mapThin),
        }),
      )
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setData({ counters: [], allRanks: false, map: null, mapThin: false });
      });
    return () => controller.abort();
  }, [id, ownRank, mapName]);

  const maxEdge = Math.max(0.01, ...(data?.counters ?? []).map((c) => c.edge));
  const medal = ['bg-brand text-brand-ink', 'bg-[#c9d3ee] text-[#1b2350]', 'bg-[#8a5a2b] text-[#ffe6c7]'];

  return (
    <section className="bz-panel-gold space-y-2 p-2.5">
      <header className="flex items-center gap-2.5">
        <div className="relative shrink-0">
          <Image
            src={brawler?.imageUrl ?? ''}
            alt=""
            width={48}
            height={48}
            className="size-12 rounded-lg bg-surface-2 ring-2 ring-black/40"
            unoptimized
          />
          {tier ? (
            <span
              className="display absolute -bottom-1.5 -right-1.5 grid size-5 place-items-center rounded-md text-[11px] text-white ring-2 ring-[#050a1f]"
              style={{ background: TIER_COLOR[tier] }}
            >
              {tier}
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          <h3 className="display truncate text-[15px] uppercase leading-tight text-game-stroke">
            {t('draft.beats', { name: brawler?.localName ?? String(id) })}
          </h3>
          {data?.map ? (
            <p className="flex items-center gap-1.5 text-[10px] leading-tight text-[#a3eaff]">
              {t('counters.onMap', { map: name(data.map) })}
              <button type="button" onClick={onAllMaps} className="bz-chip px-1.5 py-0 text-[9px] leading-tight">
                {t('chips.allMaps')}
              </button>
            </p>
          ) : data?.mapThin && mapName ? (
            <p className="text-[9px] leading-tight text-muted">{t('counters.mapThin', { map: name(mapName) })}</p>
          ) : data?.allRanks ? (
            <p className="text-[9px] leading-tight text-muted">{t('counters.allRanks')}</p>
          ) : null}
        </div>
      </header>

      {data === null ? (
        <p className="py-2 text-center text-[11px] text-muted">{t('draft.reading')}</p>
      ) : data.counters.length === 0 ? (
        <p className="py-2 text-center text-[11px] text-muted">
          {t('draft.noCounters', { name: brawler?.localName ?? String(id) })}
        </p>
      ) : (
        <ol className="space-y-1">
          {data.counters.map((c, index) => {
            const b = byId.get(c.brawlerId);
            return (
              <li key={c.brawlerId}>
                <button
                  type="button"
                  onClick={() => onPick(c.brawlerId)}
                  className="flex w-full items-center gap-2 rounded-lg bg-[#1b2556]/80 px-1.5 py-1 text-start"
                >
                  <span
                    aria-hidden
                    className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-black tabular-nums ${medal[index] ?? 'text-muted'}`}
                  >
                    {index + 1}
                  </span>
                  <Image
                    src={b?.imageUrl ?? ''}
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 shrink-0 rounded bg-surface-2"
                    loading="lazy"
                    unoptimized
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold leading-tight">{b?.localName ?? c.brawlerId}</span>
                    <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-black/30">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-victory/70 to-victory"
                        style={{ width: `${Math.max(8, (c.edge / maxEdge) * 100)}%` }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-end leading-tight">
                    <span className="block text-[13px] font-black tabular-nums text-victory">
                      {(c.winRate * 100).toFixed(0)}%
                    </span>
                    <span className="block text-[9px] tabular-nums text-muted">
                      {t('meta.vsUsual', { n: `+${(c.edge * 100).toFixed(1)}` })}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {brawler ? (
        <a
          href={`${sitePrefix(lang)}/brawlers/${slugify(brawler.brawlerName)}/counters`}
          className="block text-end text-[10px] font-semibold text-brand"
        >
          {t('draft.allCounters')}
        </a>
      ) : null}
    </section>
  );
}
