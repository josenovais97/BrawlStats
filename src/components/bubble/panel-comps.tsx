'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { BuildCard, useBuildCard } from '@/components/bubble/panel-build';
import { ModeMapChips, recall, remember, STORED_MAP, STORED_MODE } from '@/components/bubble/panel-chips';
import type { PanelMode } from '@/components/bubble/panel-tiers';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';
import { canField } from '@/lib/bubble-account';
import { panelTrack } from '@/lib/panel-telemetry';

/** One trio as the panel draws it. */
export interface PanelComp {
  brawlers: { brawlerId: number; brawlerName: string; imageUrl: string }[];
  winRate: number;
  /** Win rate minus the map's (or mode's) own, in points. */
  edge: number;
  battles: number;
}

export interface PanelModeComps {
  /** The mode's best Ranked trios, the fallback for a map without its own. */
  mode: PanelComp[];
  /** Per Ranked map with enough trios of its own. */
  maps: Record<string, PanelComp[]>;
}

/** Below this many battles a trio is shown, but labelled as a thin sample. */
const THIN = 30;

/**
 * The best three to take, on the map you are drafting.
 *
 * The Meta tab answers "who is strong here"; this answers the question a team
 * actually has in the draft lobby: which three work *together*. Ranked only,
 * because that is the draft the bubble is opened in.
 *
 * Per map when the map has enough Ranked trios of its own, which in practice
 * means the busy Knockout and Brawl Ball maps. Anywhere else it says so and
 * falls back to the mode's best, rather than showing a map's three noisiest
 * trios as if they were advice.
 *
 * With an account configured, every brawler you own gets a tick, a trio you
 * can field entirely is marked, and one switch narrows the list to those.
 */
export function PanelComps({
  modes,
  comps,
}: {
  modes: PanelMode[];
  comps: Record<string, PanelModeComps>;
}) {
  // The combined "All" list has no comps of its own: a trio is a mode answer.
  const pickable = modes.filter((m) => m.key !== null && comps[m.key]);
  const [active, setActive] = useState<string | null>(pickable[0]?.key ?? null);
  const [map, setMap] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);

  const account = useBubbleAccount();
  // Tap any brawler in a trio for its build: the same card the Meta tab opens.
  const { open, build, cardRef, toggle } = useBuildCard<PanelComp['brawlers'][number]>();
  const owns = (id: number) => account.owned !== null && canField(account.owned, id, account.filter);

  // Same saved mode and map as the Meta tab: the draft is on one map, and
  // re-choosing it per tab is exactly the tap the panel exists to save.
  useEffect(() => {
    const saved = recall();
    if (!saved.mode || !pickable.some((m) => m.key === saved.mode)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(saved.mode);
    const mode = pickable.find((m) => m.key === saved.mode);
    if (saved.map && mode?.maps.some((m) => m.mapName === saved.map)) setMap(saved.map);
    // Read once on mount; `pickable` is derived from server props that do not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pickable.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs text-muted">
        Not enough sampled Ranked teams yet. This fills in as the sampler runs.
      </p>
    );
  }

  const current = pickable.find((m) => m.key === active) ?? pickable[0];
  const data = comps[current.key!];
  const mapComps = map ? data.maps[map] : undefined;
  const list = mapComps ?? data.mode;
  const fellBack = map !== null && !mapComps;
  const shown = onlyMine ? list.filter((c) => c.brawlers.every((b) => owns(b.brawlerId))) : list;

  return (
    <>
      <p className="display px-1 pb-2 text-[13px] uppercase tracking-normal [word-spacing:0.18em] text-foreground">
        Best Ranked trios <span className="text-[11px] text-muted">· last 14 days</span>
      </p>

      <ModeMapChips
        modes={pickable}
        mode={current}
        map={map}
        allMapsLabel="Whole mode"
        hasData={(name) => Boolean(data.maps[name])}
        onMode={(key) => {
          setActive(key);
          setMap(null);
          remember(STORED_MODE, key);
          remember(STORED_MAP, null);
        }}
        onMap={(name) => {
          if (name) panelTrack('panel_map', { tab: 'comps', mode: current.key ?? 'all', map: name });
          setMap(name);
          remember(STORED_MAP, name);
        }}
      />

      {fellBack ? (
        <p className="bz-panel mx-1 mb-2 px-2 py-1.5 text-[11px] leading-snug text-muted">
          Not enough Ranked games on <span className="font-bold text-foreground">{map}</span> yet.
          Showing the best trios across {current.label}.
        </p>
      ) : null}

      {account.owned !== null ? (
        <label className="mx-1 mb-2 flex items-center gap-2 text-[11px] font-bold text-muted">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => {
              setOnlyMine(e.target.checked);
              panelTrack('panel_comps_mine', { on: e.target.checked });
            }}
            className="size-3.5 accent-[var(--brand)]"
          />
          Only trios I can run
        </label>
      ) : null}

      {shown.length === 0 ? (
        <p className="px-2 py-6 text-center text-xs text-muted">
          {onlyMine
            ? 'None of these trios is fully in your roster yet.'
            : `Not enough sampled Ranked teams in ${current.label} yet.`}
        </p>
      ) : (
        <ol className="space-y-1.5 px-1">
          {shown.map((comp, i) => {
            const mine = account.owned !== null && comp.brawlers.every((b) => owns(b.brawlerId));
            return (
              <li
                key={comp.brawlers.map((b) => b.brawlerId).join('-')}
                className={`flex items-center gap-2 px-2 py-1.5 ${mine ? 'bz-panel-gold' : 'bz-panel'}`}
              >
                <span className="display w-5 shrink-0 text-center text-base tabular-nums text-brand">
                  {i + 1}
                </span>

                <span className="flex shrink-0 -space-x-1">
                  {comp.brawlers.map((b) => (
                    <button
                      key={b.brawlerId}
                      type="button"
                      onClick={() => {
                        if (open?.brawlerId !== b.brawlerId) {
                          panelTrack('panel_build', { tab: 'comps', brawler: b.brawlerName });
                        }
                        toggle(b);
                      }}
                      aria-pressed={open?.brawlerId === b.brawlerId}
                      aria-label={`${b.brawlerName}: show build`}
                      className={`relative rounded-md ${
                        open?.brawlerId === b.brawlerId ? 'z-10 ring-2 ring-brand' : ''
                      }`}
                    >
                      <Image
                        src={b.imageUrl}
                        alt={b.brawlerName}
                        width={36}
                        height={36}
                        className={`size-9 rounded-lg border-2 border-[#050a1f] bg-surface-2 object-cover ${
                          account.owned !== null && !owns(b.brawlerId) ? 'opacity-45 grayscale' : ''
                        }`}
                        loading="lazy"
                        unoptimized
                      />
                      {owns(b.brawlerId) ? (
                        <span
                          aria-label="You own this brawler"
                          className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full bg-victory text-[9px] font-black leading-none text-background"
                        >
                          ✓
                        </span>
                      ) : null}
                    </button>
                  ))}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-bold leading-tight">
                    {comp.brawlers.map((b) => b.brawlerName).join(' · ')}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[10px] leading-tight text-muted">
                    <span className="tabular-nums">{comp.battles} games</span>
                    {comp.battles < THIN ? (
                      <span className="rounded bg-surface-2 px-1 font-bold">thin sample</span>
                    ) : null}
                    {mine ? (
                      <span className="bz-chip-on shrink-0 px-1.5 py-px text-[9px]" title="You own all three">✓ Yours</span>
                    ) : null}
                  </span>
                </span>

                <span className="shrink-0 text-right leading-tight">
                  <span className="display block text-lg leading-none tabular-nums">
                    {Math.round(comp.winRate * 100)}%
                  </span>
                  <span
                    className={`block text-[10px] font-bold tabular-nums ${
                      comp.edge >= 0 ? 'text-victory' : 'text-defeat'
                    }`}
                  >
                    {comp.edge >= 0 ? '+' : '−'}
                    {Math.abs(comp.edge * 100).toFixed(1)} vs avg
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {shown.length > 0 ? (
        <p className="px-2 pt-2 text-center text-[10px] text-muted">Tap a brawler for its build.</p>
      ) : null}
      {open ? <BuildCard ref={cardRef} entry={open} build={build} /> : null}
    </>
  );
}
