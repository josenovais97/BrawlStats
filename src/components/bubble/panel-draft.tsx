'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { PanelMap, PanelMode } from '@/components/bubble/panel-tiers';
import type { ScanPayload } from '@/lib/bubble-scan';
import { correctionIndex, mergeSlots, resolvePlate } from '@/lib/bubble-scan';

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

/** Long enough to read, short enough that three fit on one line. */
const LABELS: Record<Slot, string> = { bans: 'Ban', allies: 'You', enemies: 'Vs' };

/** For the picker's placeholder, where there is room for the real word. */
const LONG: Record<Slot, string> = { bans: 'bans', allies: 'your team', enemies: 'the enemy' };

/**
 * Below this, a map figure is mostly the prior rather than the map.
 *
 * Matches MIN_SAMPLE_FOR_MAP_FORM on the site, so the two do not disagree
 * about what counts as thin.
 */
const THIN_SAMPLE = 30;

const STORED_DRAFT = 'brawlzone.bubble.draft';

/**
 * What the Android build exposes when it can read the screen.
 *
 * Absent in a browser, and absent in app builds before 1.8, so every use is
 * guarded rather than assumed — the panel is one page served to both.
 */
interface ScanBridge {
  status(): string;
  roster(json: string): void;
  enable(): void;
  scan(): void;
  stop(): void;
  learn(kind: string, index: number, brawlerId: number): void;
  learnPlate(modeKey: string | null, mapName: string | null): void;
}

type ScanState =
  | 'unsupported'
  | 'idle'
  | 'ready'
  | 'busy'
  | 'preparing'
  | 'denied'
  | 'failed'
  | 'noroster';

/** What the scan button says, per state. */
const SCAN_LABEL: Record<ScanState, string> = {
  unsupported: '',
  idle: 'Scan draft',
  ready: 'Scan draft',
  busy: 'Reading screen…',
  preparing: 'Loading portraits…',
  denied: 'Scan draft',
  failed: 'Scan draft',
  noroster: 'Scan draft',
};

/**
 * Anything the reader has to do something about.
 *
 * Kept beside the labels so a state cannot be added without deciding what it
 * says — the first version had no line for the case where the app has no
 * portraits to match against, so the button read "Loading portraits…" forever
 * and the panel never explained why.
 */
const SCAN_NOTE: Partial<Record<ScanState, string>> = {
  failed: 'Could not read the screen. Try again with the draft on screen.',
  noroster: 'Waiting for brawler data — reopen the panel in a moment.',
};

/**
 * How long a half-finished draft is worth restoring.
 *
 * Every tap on the bubble builds a fresh WebView, so without this the board
 * emptied every time the panel closed — check a pick, glance at the game, come
 * back, and the six bans you just entered are gone. That is the single worst
 * thing an overlay can do, because closing it is the normal way to use it.
 *
 * Half an hour rather than forever: a draft from yesterday restored under
 * today's match is worse than an empty board, and matches do not last thirty
 * minutes.
 */
const DRAFT_TTL_MS = 30 * 60 * 1000;

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
  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState('');
  const [picks, setPicks] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [scanState, setScanState] = useState<ScanState>('unsupported');
  const [scanNote, setScanNote] = useState<string | null>(null);
  /*
   * The last reading, kept positionally.
   *
   * The board holds a compact list per slot, but the app learns from *screen
   * positions* — so a correction can only be attributed if we still know which
   * position it went unread at. See `correctionIndex`.
   */
  const lastScan = useRef<ScanPayload | null>(null);
  /* The same payload, as state, because diagnostics renders it and a ref read
     during render is exactly the stale-value trap refs are warned about. */
  const [lastPayload, setLastPayload] = useState<ScanPayload | null>(null);

  const byId = useMemo(
    () => new Map(roster.map((b) => [b.brawlerId, b])),
    [roster],
  );

  const currentMode = withMaps.find((m) => m.key === mode) ?? null;

  /* The draft in progress, so closing the bubble does not empty the board. */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORED_DRAFT);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        map?: string;
        at?: number;
        bans?: number[];
        allies?: number[];
        enemies?: number[];
      };
      if (!saved.map || Date.now() - (saved.at ?? 0) > DRAFT_TTL_MS) return;

      for (const m of withMaps) {
        const found = m.maps.find((x) => x.mapName === saved.map);
        if (!found) continue;
        /*
         * Reading a browser store is the "synchronise with an external system"
         * case effects exist for: the value cannot be known during render, and
         * seeding it into initial state would make the server and the client
         * disagree about what is selected. It runs once.
         */
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMode(m.key);
        setMap(found);
        setPicked({
          bans: saved.bans ?? [],
          allies: saved.allies ?? [],
          enemies: saved.enemies ?? [],
        });
        return;
      }
    } catch {
      // Malformed or blocked storage. An empty board is a fine outcome; a
      // panel that fails to render is not.
    }
  }, [withMaps]);

  /* Written on every change, so whatever is on screen survives a close. */
  useEffect(() => {
    if (!map) return;
    try {
      window.localStorage.setItem(
        STORED_DRAFT,
        JSON.stringify({ map: map.mapName, at: Date.now(), ...picked }),
      );
    } catch {
      // ignored
    }
  }, [map, picked]);

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

  const applyRef = useRef<(payload: ScanPayload) => void>(() => {});
  const applyScan = useCallback((payload: ScanPayload) => applyRef.current(payload), []);

  /*
   * The scan bridge, if this is the app rather than a browser.
   *
   * Two things are handed over on the way in. The callbacks go on `window`
   * because Kotlin can only call into the page by evaluating a string, and the
   * roster goes over because the matcher needs to know which brawlers exist —
   * shipping that list inside the APK would mean a release every time a brawler
   * comes out, and the panel already has it.
   */
  useEffect(() => {
    const bridge = (window as unknown as { BrawlZoneScan?: ScanBridge }).BrawlZoneScan;
    if (!bridge) return;

    const api = (window as unknown as { brawlzone?: Record<string, unknown> }).brawlzone ?? {};
    api.scanState = (state: string) => setScanState(state as ScanState);
    api.scanResult = (payload: ScanPayload) => applyScan(payload);
    (window as unknown as { brawlzone: Record<string, unknown> }).brawlzone = api;

    try {
      /*
       * Reading a capability off the host is the "synchronise with an external
       * system" case effects exist for: whether this page is inside the app,
       * and whether capture is already granted, cannot be known during render
       * and must not differ between the server and the first client paint.
       */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScanState(bridge.status() as ScanState);
      bridge.roster(JSON.stringify(roster.map((b) => b.brawlerId)));
    } catch {
      setScanState('unsupported');
    }
    // `applyScan` closes over the current board, and re-registering the
    // callbacks on every board change would be a lot of churn for no gain —
    // the ref below is what keeps the handler current instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster]);

  const handleScan = (payload: ScanPayload) => {
    lastScan.current = payload;
    setLastPayload(payload);

    if (!payload.ok) {
      setScanNote('Could not read the screen. Is the draft on screen?');
      return;
    }

    const plate = resolvePlate(payload, withMaps);
    /*
     * A different map means a different match, so the board resets. Anything
     * else merges: a scan is one frame of a draft still in progress, and the
     * reader may have typed in a ban the app could not identify.
     */
    const changedMap = plate.map !== null && plate.map.mapName !== map?.mapName;
    if (plate.mode !== null) {
      setMode(plate.mode);
      if (plate.map === null) setChanging(true);
    }
    if (plate.map !== null) {
      setMap(plate.map);
      setChanging(false);
    }

    const base = changedMap ? { bans: [], allies: [], enemies: [] } : picked;
    setPicked(mergeSlots(base, payload, LIMITS));
    if (changedMap) setPicks(null);

    const found =
      (payload.bans ?? []).filter((x) => x !== null).length +
      (payload.allies ?? []).filter((x) => x !== null).length +
      (payload.enemies ?? []).filter((x) => x !== null).length;

    /*
     * Says what it did *not* get, not what it did.
     *
     * The board already shows what was recognised — the portraits are right
     * there. What the reader cannot see is whether the app looked and gave up
     * or never looked at all, and that is the difference between tapping the
     * gaps in and scanning again.
     *
     * The first time on any map it will not know the map, and saying so plainly
     * is what makes the next line — pick it once and it is remembered — read as
     * an instruction rather than an apology.
     */
    /*
     * Leads with what it read, not with what it wants.
     *
     * "Pick the map below" on its own reads as a refusal — the reader tapped
     * Scan and got a instruction back, with no sign anything happened. Saying
     * the count first makes the same sentence a report with a next step, and it
     * is the only signal that the recognition side is working at all on a map
     * the app has not been taught yet.
     */
    const read = found === 1 ? '1 brawler' : `${found} brawlers`;
    if (plate.map === null && found === 0) {
      setScanNote('Nothing recognised. Scan with the draft screen showing.');
    } else if (plate.map === null) {
      setScanNote(`Read ${read}. Pick the map — it is remembered for next time.`);
    } else if (found === 0) {
      setScanNote(`${plate.map.mapName}. No brawlers read — tap them in.`);
    } else {
      setScanNote(`Read ${read} on ${plate.map.mapName}.`);
    }
  };

  /*
   * The handler the bridge reaches, kept current.
   *
   * `window.brawlzone.scanResult` is installed once, but it has to see the
   * board as it is when the scan lands rather than as it was when the panel
   * opened. Assigning the ref after every render is the smallest way to have
   * both a stable callback and fresh state.
   */
  useEffect(() => {
    applyRef.current = handleScan;
  });

  /**
   * One button for three states: ask, scan, wait.
   *
   * Granting capture runs straight into a scan on the other side, so the reader
   * taps once whether or not they have granted it before. Being asked for a
   * permission and then having to find the button again is the kind of thing
   * that makes a feature feel broken when it is working.
   */
  const runScan = () => {
    const bridge = (window as unknown as { BrawlZoneScan?: ScanBridge }).BrawlZoneScan;
    if (!bridge) return;
    setScanNote(null);
    try {
      if (scanState === 'ready') bridge.scan();
      else bridge.enable();
    } catch {
      setScanNote('Screen reading is not available on this build.');
    }
  };

  const chooseMap = (m: PanelMap) => {
    setMap(m);
    setChanging(false);
    /*
     * Confirming a map is how the app learns to read the plate.
     *
     * It still has the frame it scanned, so this files that plate under the
     * name chosen here — and every later scan on this map fills it in with no
     * taps at all. Only after a scan: with no frame in hand there is nothing to
     * file, and a map chosen from a cold panel says nothing about any picture.
     */
    if (lastScan.current) {
      const bridge = (window as unknown as { BrawlZoneScan?: ScanBridge }).BrawlZoneScan;
      try {
        bridge?.learnPlate(m.mode ?? mode, m.mapName);
      } catch {
        // A build without the bridge, or one that has since lost the frame.
      }
    }
    // Cleared here rather than in the effect: a new map invalidates the old
    // answer, and that is a consequence of the tap, not of the fetch.
    setPicks(null);
    setPicked({ bans: [], allies: [], enemies: [] });
  };

  /* One tap back to an empty board, because the next match is a new draft. */
  const clear = () => {
    setPicked({ bans: [], allies: [], enemies: [] });
    setPicking(null);
    setPicks(null);
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

      const next = { ...cleaned, [slot]: [...cleaned[slot], id] };

      /*
       * Closes when the slot is full, and not before.
       *
       * It used to close on every pick, which is fine for a single enemy and
       * miserable for six bans: six selections meant six reopenings, and the
       * grid lost its scroll position each time. A slot that holds several
       * things should stay open until it holds them.
       */
      if (next[slot].length >= LIMITS[slot]) setPicking(null);
      return next;
    });
    teach(slot, id);
    // Cleared so the next name can be typed straight away; the field keeps
    // focus, so a reader filling bans types, taps, types, taps.
    setQuery('');
  };

  /**
   * Tells the app what it should have read, when that can be said unambiguously.
   *
   * The app keeps the frame it scanned, so a correction stores the pixels it
   * misread against the brawler chosen here — a reference taken from this
   * phone's own screen, which beats a CDN render every time. That only works if
   * the correction can be pinned to a screen position, so `correctionIndex`
   * refuses when more than one slot went unread. A reference learned against
   * the wrong position would be worse than none, because it would score highly
   * against exactly the thing it is wrong about.
   */
  const teach = (slot: Slot, id: number) => {
    const payload = lastScan.current;
    if (!payload) return;
    const index = correctionIndex(payload[slot]);
    if (index === null) return;

    const bridge = (window as unknown as { BrawlZoneScan?: ScanBridge }).BrawlZoneScan;
    if (!bridge) return;
    try {
      bridge.learn(slot, index, id);
      // Recorded, so the same gap is not attributed twice if the reader
      // changes their mind about it.
      const updated = [...(payload[slot] ?? [])];
      updated[index] = id;
      lastScan.current = { ...payload, [slot]: updated };
    } catch {
      // A build without the bridge, or one that has since lost the frame.
    }
  };

  const remove = (slot: Slot, id: number) =>
    setPicked((prev) => ({ ...prev, [slot]: prev[slot].filter((x) => x !== id) }));

  const taken = new Set([...picked.bans, ...picked.allies, ...picked.enemies]);

  /*
   * The map's own best brawlers, offered first.
   *
   * These are the picks and bans a draft on this map actually revolves around,
   * so scanning eight portraits you already expect beats typing a name — and
   * the reader is under a timer. The full roster stays underneath for the ones
   * that surprise you.
   */
  const likely = useMemo(() => {
    if (!map) return [];
    return map.picks
      .filter((p) => !taken.has(p.brawlerId))
      .slice(0, 8)
      .map((p) => byId.get(p.brawlerId))
      .filter((b): b is DraftBrawler => b !== undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, picked, byId]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = roster.filter((b) => !taken.has(b.brawlerId));
    if (!q) return pool;
    return pool.filter((b) => b.brawlerName.toLowerCase().includes(q));
    // `taken` is derived from `picked`; listing it would re-filter every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, roster, picked]);

  const canScan = scanState !== 'unsupported';

  /*
   * What the app on the other side of this page actually is.
   *
   * Written after four releases of fixing bugs remotely and being told nothing
   * changed each time. The panel is a web page and redeploys in minutes; the
   * APK does not, so the two halves of a fix arrive at different times through
   * the same window, and there was no way — from the screen — to tell a fix
   * that did not work from a fix that was not installed.
   *
   * The page can answer that itself without an app update, which is the point:
   * the bridge's method list is a fingerprint of the build behind it.
   * `openExternal` only exists from 1.9, `learnPlate` from 1.8.4. So even an
   * install too old to report anything useful about itself can be identified by
   * what it can and cannot do.
   */
  const diagnostics = () => {
    const w = window as unknown as { BrawlZoneScan?: Record<string, unknown> };
    const bridge = w.BrawlZoneScan;
    const methods = bridge
      ? ['status', 'roster', 'enable', 'scan', 'stop', 'learn', 'learnPlate', 'openExternal']
          .filter((m) => typeof bridge[m] === 'function')
      : [];
    const last = lastPayload;
    return [
      `app  ${window.location.hash || '(no version)'}`,
      `scan ${scanState}`,
      `api  ${bridge ? methods.join(',') : 'absent — not running in the app'}`,
      last
        ? `read map=${last.map ?? '-'} mode=${last.mode ?? '-'} text=${JSON.stringify(last.text ?? [])}`
        : 'read (no scan yet)',
      last
        ? `slots bans=${JSON.stringify(last.bans ?? [])} you=${JSON.stringify(last.allies ?? [])} vs=${JSON.stringify(last.enemies ?? [])}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  };
  const anythingPicked =
    picked.bans.length + picked.allies.length + picked.enemies.length > 0;

  return (
    <div className="space-y-2">
      {/*
        The scan button, on top of everything else.

        It sits above the map selector rather than beside it because it is the
        answer to the same question: on a good scan the map is filled in and the
        two rows below become a confirmation rather than a task. Under a draft
        timer, one tap that fills the whole board is the entire feature.
      */}
      {canScan ? (
        <div className="space-y-1">
          <button
            type="button"
            onClick={runScan}
            disabled={scanState === 'busy' || scanState === 'preparing'}
            className={`flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-bold transition-colors ${
              scanState === 'busy' || scanState === 'preparing'
                ? 'border-border bg-surface text-muted'
                : 'border-accent-2/50 bg-accent-2/10 text-accent-2'
            }`}
          >
            <span
              aria-hidden
              className={scanState === 'busy' ? 'animate-pulse' : undefined}
            >
              ◎
            </span>
            {SCAN_LABEL[scanState]}
          </button>

          {/*
            Only ever says something when there is something to say. A status
            line that reads "ready" under a button labelled "Scan draft" is a
            row of a small screen spent on nothing.
          */}
          {scanNote ?? SCAN_NOTE[scanState] ? (
            <p className="px-1 text-[10px] leading-snug text-muted">
              {scanNote ?? SCAN_NOTE[scanState]}
            </p>
          ) : null}
          {/*
            Collapsed, because it is for the two occasions it is needed: a fix
            that appears not to have worked, and a scan that read the wrong
            thing. Open, it is one screenshot that settles both.
          */}
          <details className="px-1">
            <summary className="cursor-pointer text-[10px] text-muted/70">
              Diagnostics
            </summary>
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded border border-border bg-surface p-1.5 text-[9px] leading-relaxed text-muted">
              {diagnostics()}
            </pre>
          </details>

          {scanState === 'denied' ? (
            <p className="px-1 text-[10px] leading-snug text-muted">
              Android needs permission each time the app starts. Nothing is stored or sent —
              the frame is read and dropped.
            </p>
          ) : null}
        </div>
      ) : null}

      {/*
        The selector folds away once it has done its job.

        Mode and map chips are two full rows, and in a 375dp-tall window that is
        a fifth of the screen spent restating a choice already made. Collapsed
        to one line, the space goes to the answer — which is the only thing on
        this tab anyone is reading under a draft timer.
      */}
      {map && !changing ? (
        <button
          type="button"
          onClick={() => setChanging(true)}
          className="flex w-full items-center gap-1.5 px-1 pb-1 text-left text-[11px]"
        >
          <span className="font-bold text-accent-2">{map.mapName}</span>
          <span className="text-muted">· {currentMode?.label}</span>
          <span className="ml-auto rounded border border-border px-1.5 py-0.5 font-bold text-muted">
            Change
          </span>
        </button>
      ) : (
        <>
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
        </>
      )}

      {/*
        The board appears as soon as there is anything on it, map or no map.
        
        It used to be gated on the map alone, which made a successful scan look
        like a failure: the app read the draft, the brawlers went into state,
        and the panel showed "Pick the mode, then the map" over an empty space.
        The one thing that proves the scan worked was the one thing hidden until
        after the reader had done the work it was meant to save them.
      */}
      {!map && !anythingPicked ? (
        <p className="px-2 py-6 text-center text-xs leading-relaxed text-muted">
          Pick the mode, then the map you are drafting on.
        </p>
      ) : (
        <>
          {/*
            One row, not three cards.

            Three full-width cards cost 150px of a 375px window to hold at most
            eleven small portraits, and "Your team" wrapped onto a second line
            for no reason at all. Grouped on one line the board reads as what it
            is — the state of the draft — and the suggestions start above the
            fold instead of below it.
          */}
          <div className="card flex flex-wrap items-center gap-x-2.5 gap-y-1 px-2 py-1.5">
            {(['bans', 'allies', 'enemies'] as Slot[]).map((slot) => (
              <div key={slot} className="flex items-center gap-1">
                <span className="text-[9px] font-bold uppercase tracking-wide text-muted">
                  {LABELS[slot]}
                  {/* The count only appears once something is in the slot: a
                      board showing 0/6 before anyone has done anything reads
                      as a form to fill in rather than a draft to follow. */}
                  {picked[slot].length > 0 ? (
                    <span className="ml-0.5 tabular-nums text-muted/70">
                      {picked[slot].length}/{LIMITS[slot]}
                    </span>
                  ) : null}
                </span>

                {picked[slot].map((id) => {
                  const b = byId.get(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => remove(slot, id)}
                      title={`Remove ${b?.brawlerName ?? id}`}
                    >
                      <Image
                        src={b?.imageUrl ?? ''}
                        alt={b?.brawlerName ?? ''}
                        width={24}
                        height={24}
                        className={`size-6 rounded bg-surface-2 ${
                          slot === 'bans' ? 'opacity-40 grayscale' : ''
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
                    aria-label={`Add to ${LONG[slot]}`}
                    className={`grid size-6 place-items-center rounded border text-xs font-bold leading-none ${
                      picking === slot
                        ? 'border-brand bg-brand/15 text-brand'
                        : 'border-dashed border-border-strong text-muted'
                    }`}
                  >
                    +
                  </button>
                ) : null}
              </div>
            ))}

            {/* Only once there is something to clear. A reset button on an
                empty board is a control that does nothing. */}
            {picked.bans.length + picked.allies.length + picked.enemies.length > 0 ? (
              <button
                type="button"
                onClick={clear}
                className="ml-auto shrink-0 rounded border border-border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted"
              >
                Clear
              </button>
            ) : null}
          </div>

          {picking ? (
            <BrawlerPicker
              matches={matches}
              likely={likely}
              query={query}
              onQuery={setQuery}
              onPick={(id) => add(picking, id)}
              onClose={() => setPicking(null)}
              label={LONG[picking]}
              remaining={LIMITS[picking] - picked[picking].length}
            />
          ) : null}

          {map ? (
            <Suggestions picks={picks} loading={loading} byId={byId} />
          ) : (
            <p className="px-2 py-3 text-center text-[11px] leading-relaxed text-muted">
              Pick the mode and map above to score these picks — the app
              remembers that map and fills it in on the next scan.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Ninety brawlers in a window this size, made findable.
 *
 * Two ways in, because a draft has two kinds of moment. Most of the time the
 * brawler being banned or countered is one of the handful this map revolves
 * around, and scanning eight portraits you already expect is faster than
 * typing. The rest of the time it is a surprise, and then a search box beats
 * scrolling ninety.
 *
 * The field keeps focus and clears after each pick, so filling six bans is
 * type-tap-type-tap rather than six trips through a menu.
 */
function BrawlerPicker({
  matches,
  likely,
  query,
  onQuery,
  onPick,
  onClose,
  label,
  remaining,
}: {
  matches: DraftBrawler[];
  likely: DraftBrawler[];
  query: string;
  onQuery: (q: string) => void;
  onPick: (id: number) => void;
  onClose: () => void;
  label: string;
  remaining: number;
}) {
  const searching = query.trim().length > 0;

  return (
    <div className="card space-y-1.5 p-2">
      <div className="flex items-center gap-1.5">
        {/*
          No autoFocus, and that single word was most of the problem.
          
          Focusing on open raised the keyboard the instant the picker appeared,
          which covered the shortlist that exists precisely so most picks need
          no typing — the fast path was hidden by the slow one before the reader
          could see it. The field is still there for the pick that surprises
          you; it just waits to be asked for.
        */}
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={`Add to ${label}…`}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-brand/50"
        />
        <span className="shrink-0 text-[10px] tabular-nums text-muted">{remaining} left</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the picker"
          className="shrink-0 rounded border border-border px-1.5 py-1 text-[10px] font-bold text-muted"
        >
          Done
        </button>
      </div>

      {/* The shortlist, hidden the moment a search narrows things itself. */}
      {!searching && likely.length > 0 ? (
        <>
          <p className="px-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
            Likely here — tap one
          </p>
          <div className="flex flex-wrap gap-1">
            {likely.map((b) => (
              <PickerTile key={b.brawlerId} brawler={b} onPick={onPick} />
            ))}
          </div>
          <p className="px-0.5 pt-0.5 text-[9px] font-bold uppercase tracking-wide text-muted">
            Everyone
          </p>
        </>
      ) : null}

      <div className="flex max-h-[8rem] flex-wrap gap-1 overflow-y-auto">
        {matches.map((b) => (
          <PickerTile key={b.brawlerId} brawler={b} onPick={onPick} />
        ))}

        {matches.length === 0 ? (
          <p className="w-full px-1 py-3 text-center text-xs text-muted">
            No brawler by that name.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PickerTile({
  brawler,
  onPick,
}: {
  brawler: DraftBrawler;
  onPick: (id: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(brawler.brawlerId)}
      title={brawler.brawlerName}
      className="w-9 text-center"
    >
      <Image
        src={brawler.imageUrl}
        alt={brawler.brawlerName}
        width={34}
        height={34}
        className="size-[34px] rounded bg-surface-2"
        loading="lazy"
        unoptimized
      />
      <span className="block truncate text-[8px] leading-tight text-muted">
        {brawler.brawlerName.toLowerCase()}
      </span>
    </button>
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
                {/*
                  The battle count appears only when it is thin.
                  Printing it on every row would spend the width on a number
                  that is usually reassuring and never acted on; printing it
                  when it is small is the only time it changes a decision — a
                  61% off twelve battles and a 61% off two hundred are not the
                  same claim, and the list cannot show that any other way.
                */}
                <span>map {(pick.mapScore * 100).toFixed(0)}%</span>
                {pick.battles < THIN_SAMPLE ? (
                  <span className="text-defeat/70">{pick.battles} battles</span>
                ) : null}
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
