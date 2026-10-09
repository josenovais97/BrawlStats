'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { ModeMapChips, recall, remember, STORED_MAP, STORED_MODE } from '@/components/bubble/panel-chips';
import type { PanelMode } from '@/components/bubble/panel-tiers';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';
import { canField } from '@/lib/bubble-account';

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
      <p className="px-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
        Best Ranked trios · last 14 days
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
          setMap(name);
          remember(STORED_MAP, name);
        }}
      />

      {fellBack ? (
        <p className="mx-1 mb-2 rounded-md border border-border bg-surface px-2 py-1.5 text-[11px] leading-snug text-muted">
          Not enough Ranked games on <span className="font-bold text-foreground">{map}</span> yet.
          Showing the best trios across {current.label}.
        </p>
      ) : null}

      {account.owned !== null ? (
        <label className="mx-1 mb-2 flex items-center gap-2 text-[11px] font-bold text-muted">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
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
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                  mine ? 'border-brand/50 bg-brand/5' : 'border-border bg-surface'
                }`}
              >
                <span className="w-4 shrink-0 text-center text-[11px] font-black tabular-nums text-muted">
                  {i + 1}
                </span>

                <span className="flex shrink-0 -space-x-1">
                  {comp.brawlers.map((b) => (
                    <span key={b.brawlerId} className="relative" title={b.brawlerName}>
                      <Image
                        src={b.imageUrl}
                        alt={b.brawlerName}
                        width={36}
                        height={36}
                        className={`size-9 rounded-md border-2 border-background bg-surface-2 object-cover ${
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
                    </span>
                  ))}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-bold leading-tight">
                    {comp.brawlers.map((b) => b.brawlerName).join(' · ')}
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] leading-tight text-muted">
                    <span className="tabular-nums">{comp.battles} games</span>
                    {comp.battles < THIN ? (
                      <span className="rounded bg-surface-2 px-1 font-bold">thin sample</span>
                    ) : null}
                    {mine ? <span className="font-bold text-brand">You can run this</span> : null}
                  </span>
                </span>

                <span className="shrink-0 text-right leading-tight">
                  <span className="block text-sm font-black tabular-nums">
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
    </>
  );
}
