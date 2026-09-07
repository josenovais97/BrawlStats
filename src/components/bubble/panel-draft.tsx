'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import type { PanelMap, PanelMode } from '@/components/bubble/panel-tiers';

/**
 * The draft board, at overlay scale.
 *
 * The meta tab answers "who is strong here". This answers the question that
 * actually gets asked with eight seconds on the clock: *given the bans, given
 * what my team already took and what theirs did, what is left that is good?*
 *
 * Three constraints shaped every decision below.
 *
 * It has to fit. A landscape panel is ~460x375dp, so the board is three strips
 * of small portraits rather than the site's roomy slots, and the suggestion
 * list starts before the fold.
 *
 * It has to be fast. Selection is local; only the scoring is a request, and
 * that request is debounced so tapping through three enemies is one call and
 * not three.
 *
 * It has to be forgiving. Every slot clears on a tap, because the common
 * mistake mid-draft is picking the wrong portrait from a grid of ninety at
 * speed, and an undo that needs a menu is an undo nobody uses.
 */

export interface DraftBrawler {
  brawlerId: number;
  brawlerName: string;
  imageUrl: string;
}

interface Suggestion {
  brawlerId: number;
  brawlerName: string;
  mapScore: number;
  battles: number;
  counterEdge: number | null;
  allyEdge: number | null;
  total: number;
}

type Slot = 'bans' | 'allies' | 'enemies';

/** What a Ranked draft actually allows, so the strips cannot overfill. */
const LIMITS: Record<Slot, number> = { bans: 6, allies: 2, enemies: 3 };

const LABELS: Record<Slot, string> = {
  bans: 'Bans',
  allies: 'Your team',
  enemies: 'Enemy',
};

const STORED_TAB_MAP = 'brawlzone.bubble.draftmap';

export function PanelDraft({
  modes,
  roster,
}: {
  modes: PanelMode[];
  roster: DraftBrawler[];
}) {
  const withMaps = useMemo(() => modes.filter((m) => m.maps.length > 0), [modes]);
  const [mode, setMode] = useState<string | null>(null);
  const [map, setMap] = useState<PanelMap | null>(null);

  const [picked, setPicked] = useState<Record<Slot, number[]>>({
    bans: [],
    allies: [],
    enemies: [],
  });

  const [picking, setPicking] = useState<Slot | null>(null);
  const [query, setQuery] = useState('');
  const [picks, setPicks] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);

  const byId = useMemo(
    () => new Map(roster.map((b) => [b.brawlerId, b])),
    [roster],
  );

  const currentMode = withMaps.find((m) => m.key === mode) ?? null;

  /* The map the last draft used, so reopening mid-session skips two taps. */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORED_TAB_MAP);
      if (!saved) return;
      for (const m of withMaps) {
        const found = m.maps.find((x) => x.mapName === saved);
        if (!found) continue;
        /*
         * Reading a browser store is the "synchronise with an external system"
         * case effects exist for: the value cannot be known during render, and
         * seeding it into initial state would make the server and the client
         * disagree about which map is selected. It runs once.
         */
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMode(m.key);
        setMap(found);
        return;
      }
    } catch {
      // Storage is a convenience here, never a requirement.
    }
  }, [withMaps]);

  /*
   * Scoring, debounced.
   *
   * Every tap changes the query, and a draft is a burst of taps. Firing per tap
   * would send three requests to answer one question and race their replies —
   * the last one to arrive wins, which is not necessarily the current one.
   */
  useEffect(() => {
    if (!map) return;
    const params = new URLSearchParams({ map: map.mapName });
    if (picked.enemies.length) params.set('enemies', picked.enemies.join(','));
    if (picked.allies.length) params.set('allies', picked.allies.join(','));
    if (picked.bans.length) params.set('bans', picked.bans.join(','));

    const controller = new AbortController();
    const timer = setTimeout(() => {
      // Inside the timer, not before it: during the debounce nothing is in
      // flight yet, and a spinner for a request that has not been made is a
      // lie the reader has to wait out.
      setLoading(true);
      fetch(`/api/v1/draft-suggest?${params}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data: { picks: Suggestion[] }) => setPicks(data.picks))
        .catch((err) => {
          if ((err as Error).name !== 'AbortError') setPicks([]);
        })
        .finally(() => setLoading(false));
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [map, picked]);

  const chooseMap = (m: PanelMap) => {
    setMap(m);
    // Cleared here rather than in the effect: a new map invalidates the old
    // answer, and that is a consequence of the tap, not of the fetch.
    setPicks(null);
    setPicked({ bans: [], allies: [], enemies: [] });
    try {
      window.localStorage.setItem(STORED_TAB_MAP, m.mapName);
    } catch {
      // ignored
    }
  };

  const add = (slot: Slot, id: number) => {
    setPicked((prev) => {
      // One brawler, one place. A pick cannot also be a ban, and the game
      // would not offer it twice.
      const cleaned: Record<Slot, number[]> = {
        bans: prev.bans.filter((x) => x !== id),
        allies: prev.allies.filter((x) => x !== id),
        enemies: prev.enemies.filter((x) => x !== id),
      };
      if (cleaned[slot].length >= LIMITS[slot]) return cleaned;
      return { ...cleaned, [slot]: [...cleaned[slot], id] };
    });
    setPicking(null);
    setQuery('');
  };

  const remove = (slot: Slot, id: number) =>
    setPicked((prev) => ({ ...prev, [slot]: prev[slot].filter((x) => x !== id) }));

  const taken = new Set([...picked.bans, ...picked.allies, ...picked.enemies]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = roster.filter((b) => !taken.has(b.brawlerId));
    if (!q) return pool;
    return pool.filter((b) => b.brawlerName.toLowerCase().includes(q));
    // `taken` is derived from `picked`; listing it would re-filter every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, roster, picked]);

  return (
    <div className="space-y-2">
      {/* Map first: nothing below means anything without it. */}
      <div role="group" aria-label="Mode" className="flex flex-wrap gap-1 px-1 text-[11px]">
        {withMaps.map((m) => (
          <button
            key={m.key ?? 'all'}
            type="button"
            onClick={() => {
              setMode(m.key);
              setMap(null);
            }}
            aria-pressed={m.key === mode}
            className={`rounded-md border px-1.5 py-1 font-bold leading-tight transition-colors ${
              m.key === mode
                ? 'border-brand/40 bg-brand/10 text-brand'
                : 'border-border bg-surface text-muted'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {currentMode ? (
        <div role="group" aria-label="Map" className="flex flex-wrap gap-1 px-1 text-[11px]">
          {currentMode.maps.map((m) => (
            <button
              key={m.mapName}
              type="button"
              onClick={() => chooseMap(m)}
              aria-pressed={map?.mapName === m.mapName}
              className={`rounded-md border px-1.5 py-1 font-bold leading-tight transition-colors ${
                map?.mapName === m.mapName
                  ? 'border-accent-2/50 bg-accent-2/10 text-accent-2'
                  : 'border-border bg-surface text-muted'
              }`}
            >
              {m.mapName}
            </button>
          ))}
        </div>
      ) : null}

      {!map ? (
        <p className="px-2 py-6 text-center text-xs leading-relaxed text-muted">
          Pick the mode, then the map you are drafting on.
        </p>
      ) : (
        <>
          {/* The board. Three strips, because that is the whole state. */}
          {(['bans', 'allies', 'enemies'] as Slot[]).map((slot) => (
            <div key={slot} className="card flex items-center gap-2 px-2 py-1.5">
              <span className="w-14 shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted">
                {LABELS[slot]}
              </span>

              <div className="flex flex-1 flex-wrap items-center gap-1">
                {picked[slot].map((id) => {
                  const b = byId.get(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => remove(slot, id)}
                      title={`Remove ${b?.brawlerName ?? id}`}
                      className="relative"
                    >
                      <Image
                        src={b?.imageUrl ?? ''}
                        alt={b?.brawlerName ?? ''}
                        width={28}
                        height={28}
                        className={`size-7 rounded bg-surface-2 ${
                          slot === 'bans' ? 'opacity-45 grayscale' : ''
                        }`}
                        unoptimized
                      />
                    </button>
                  );
                })}

                {picked[slot].length < LIMITS[slot] ? (
                  <button
                    type="button"
                    onClick={() => setPicking(picking === slot ? null : slot)}
                    aria-pressed={picking === slot}
                    className={`grid size-7 place-items-center rounded border text-sm font-bold leading-none ${
                      picking === slot
                        ? 'border-brand bg-brand/15 text-brand'
                        : 'border-dashed border-border-strong text-muted'
                    }`}
                  >
                    +
                  </button>
                ) : null}
              </div>
            </div>
          ))}

          {picking ? (
            <BrawlerPicker
              matches={matches}
              query={query}
              onQuery={setQuery}
              onPick={(id) => add(picking, id)}
              label={LABELS[picking]}
            />
          ) : null}

          <Suggestions picks={picks} loading={loading} byId={byId} />
        </>
      )}
    </div>
  );
}

/**
 * Ninety brawlers in a window this size, made findable.
 *
 * A search box and a dense grid, rather than the site's larger tiles. Typing
 * two letters is faster than scrolling a roster when the clock is running, and
 * the grid stays visible so a reader who would rather scan than type still can.
 */
function BrawlerPicker({
  matches,
  query,
  onQuery,
  onPick,
  label,
}: {
  matches: DraftBrawler[];
  query: string;
  onQuery: (q: string) => void;
  onPick: (id: number) => void;
  label: string;
}) {
  return (
    <div className="card space-y-2 p-2">
      <input
        type="search"
        value={query}
        autoFocus
        onChange={(e) => onQuery(e.target.value)}
        placeholder={`Add to ${label.toLowerCase()}…`}
        className="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-brand/50"
      />

      <div className="flex max-h-[9.5rem] flex-wrap gap-1 overflow-y-auto">
        {matches.map((b) => (
          <button
            key={b.brawlerId}
            type="button"
            onClick={() => onPick(b.brawlerId)}
            title={b.brawlerName}
            className="w-9 text-center"
          >
            <Image
              src={b.imageUrl}
              alt={b.brawlerName}
              width={34}
              height={34}
              className="size-[34px] rounded bg-surface-2"
              loading="lazy"
              unoptimized
            />
            <span className="block truncate text-[8px] leading-tight text-muted">
              {b.brawlerName.toLowerCase()}
            </span>
          </button>
        ))}

        {matches.length === 0 ? (
          <p className="w-full px-1 py-3 text-center text-xs text-muted">No brawler by that name.</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * What to take, and why.
 *
 * The three inputs are printed beside the total rather than folded into it. A
 * suggestion a reader cannot check is indistinguishable from a guess dressed up
 * in a percentage, and mid-draft the *reason* is often what decides it — a pick
 * that is merely strong here is a different call from one that is strong here
 * *and* answers what they just took.
 */
function Suggestions({
  picks,
  loading,
  byId,
}: {
  picks: Suggestion[] | null;
  loading: boolean;
  byId: Map<number, DraftBrawler>;
}) {
  if (picks === null) {
    return <p className="px-2 py-4 text-center text-xs text-muted">Reading the draft…</p>;
  }

  if (picks.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-xs leading-relaxed text-muted">
        Not enough sampled battles on this map to rank what is left.
      </p>
    );
  }

  return (
    <ol className={`card divide-y divide-border overflow-hidden ${loading ? 'opacity-60' : ''}`}>
      {picks.map((pick, index) => {
        const b = byId.get(pick.brawlerId);
        return (
          <li key={pick.brawlerId} className="flex items-center gap-2 px-2 py-1.5">
            <span
              aria-hidden
              className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-black tabular-nums ${
                index === 0
                  ? 'bg-brand text-brand-ink'
                  : index === 1
                    ? 'bg-surface-3 text-foreground'
                    : index === 2
                      ? 'bg-[#8a5a2b] text-[#ffe6c7]'
                      : 'text-muted'
              }`}
            >
              {index + 1}
            </span>

            <Image
              src={b?.imageUrl ?? ''}
              alt=""
              width={28}
              height={28}
              className="size-7 shrink-0 rounded bg-surface-2"
              loading="lazy"
              unoptimized
            />

            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold capitalize leading-tight">
                {pick.brawlerName.toLowerCase()}
              </span>
              <span className="flex gap-1.5 text-[9px] leading-tight text-muted">
                <span>map {(pick.mapScore * 100).toFixed(0)}%</span>
                {pick.counterEdge !== null ? (
                  <span className={pick.counterEdge >= 0 ? 'text-victory/80' : 'text-defeat/80'}>
                    vs {pick.counterEdge >= 0 ? '+' : '−'}
                    {Math.abs(pick.counterEdge * 100).toFixed(1)}
                  </span>
                ) : null}
                {pick.allyEdge !== null ? (
                  <span className={pick.allyEdge >= 0 ? 'text-victory/80' : 'text-defeat/80'}>
                    with {pick.allyEdge >= 0 ? '+' : '−'}
                    {Math.abs(pick.allyEdge * 100).toFixed(1)}
                  </span>
                ) : null}
              </span>
            </span>

            <span className="shrink-0 text-[11px] font-black tabular-nums text-victory">
              {(pick.total * 100).toFixed(1)}%
            </span>
          </li>
        );
      })}
    </ol>
  );
}
