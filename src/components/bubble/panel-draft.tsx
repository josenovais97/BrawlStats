'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { PanelMap, PanelMode } from '@/components/bubble/panel-tiers';
import type { Board, BoardEntry, ScanPayload } from '@/lib/bubble-scan';
import {
  applyScan as applyScanPure,
  correctionIndex,
  emptyBoard,
  idsOf,
  resolvePlate,
  slotsOf,
} from '@/lib/bubble-scan';

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
 * Whether the panel offers to read the draft off the screen.
 *
 * Decided by the app on the other side of the bridge, not by a constant here.
 * The bridge's `ready` method only exists from build 34 — the first with
 * scan identity, result retention, the content-rect geometry and slot
 * statuses — and every earlier build has the faults the September review
 * documented. So an older app sees no scan button at all, and the feature is
 * enabled by shipping the APK that can carry it rather than by flipping a
 * line on a page that redeploys in minutes.
 *
 * The page can be made to show the controls without the app for layout work
 * by setting `brawlzone.bubble.scan-preview` in local storage; every bridge
 * call is guarded, so they simply do nothing there.
 */
const SCAN_PREVIEW = 'brawlzone.bubble.scan-preview';

/** The first app build whose bridge speaks this page's protocol. */
const MIN_SCAN_BUILD = 34;

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
  ready?(): void;
  ack?(id: number): void;
  ocrStatus?(): string;
  learn(scanId: number, kind: string, index: number, brawlerId: number): void;
  learnPlate(scanId: number, modeKey: string | null, mapName: string | null): void;
  exportDiagnostics?(): string;
  resetLearned?(): number;
}

function bridgeOf(): ScanBridge | undefined {
  return (window as unknown as { BrawlZoneScan?: ScanBridge }).BrawlZoneScan;
}

type ScanState =
  | 'unsupported'
  | 'idle'
  | 'ready'
  | 'busy'
  | 'consent'
  | 'preparing'
  | 'denied'
  | 'failed'
  | 'noroster'
  | 'needs-permission'
  | 'blocked';

/** What the scan button says, per state. */
const SCAN_LABEL: Record<ScanState, string> = {
  unsupported: '',
  idle: 'Scan draft',
  ready: 'Scan draft',
  busy: 'Reading screen…',
  consent: 'Waiting for permission…',
  preparing: 'Loading portraits…',
  denied: 'Allow screen reading',
  failed: 'Scan draft',
  noroster: 'Scan draft',
  /*
   * A labelled request, not a surprise.
   *
   * Scanning used to ask for screen capture by itself whenever the session was
   * missing, so a session that kept dying produced a dialog that kept coming
   * back. Consent is now something the reader asks for, on a button that says
   * what it will do.
   */
  'needs-permission': 'Allow screen reading',
  blocked: 'Screen reading unavailable',
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
  consent: 'Answer the Android dialog to share the screen.',
  noroster: 'Waiting for brawler data — reopen the panel in a moment.',
  'needs-permission':
    'Android asks once per app start. Nothing is stored or sent — the frame is read and dropped.',
  denied: 'Screen reading is off. Tap above to allow it.',
  blocked:
    'Android keeps stopping the screen share on this device — often another app is already recording. Stop that and restart the bubble, or fill the board in by hand.',
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

  /*
   * The board, as entries rather than ids: each one knows whether the reader
   * or the scanner put it there, and a scanned one knows which screen
   * position it came from. That is what lets a later scan correct a misread
   * in place without touching anything the reader typed.
   */
  const [picked, setPicked] = useState<Board>(emptyBoard);

  const [picking, setPicking] = useState<Slot | null>(null);
  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState('');
  const [picks, setPicks] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [scanState, setScanState] = useState<ScanState>('unsupported');
  /** Whether this page is talking to an app build that can scan. */
  const [scanOffered, setScanOffered] = useState(false);
  /** How far the reference tables are through building, when that is running. */
  const [scanProgress, setScanProgress] = useState<number | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  /*
   * The last reading, kept positionally.
   *
   * The app learns from *screen positions*, and a correction names the scan
   * it belongs to — so a correction can only be attributed if we still know
   * which scan is on screen and which position went unread in it.
   */
  const lastScan = useRef<ScanPayload | null>(null);
  /* The same payload, as state, because diagnostics renders it and a ref read
     during render is exactly the stale-value trap refs are warned about. */
  const [lastPayload, setLastPayload] = useState<ScanPayload | null>(null);
  /*
   * A scanned entry the reader just removed. The next brawler they add to
   * that strip is the correction for it, and the app is told which position
   * it was read from — that is the only way a correction can name the pixels
   * it is correcting.
   */
  const pendingFix = useRef<{ slot: Slot; position: number; scanId: number } | null>(null);

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
        bans?: (number | BoardEntry)[];
        allies?: (number | BoardEntry)[];
        enemies?: (number | BoardEntry)[];
      };
      if (!saved.map || Date.now() - (saved.at ?? 0) > DRAFT_TTL_MS) return;
      // An older page stored bare ids; they were the reader's, so they are
      // hand entries now.
      const entries = (list: (number | BoardEntry)[] | undefined): BoardEntry[] =>
        (list ?? []).map((e) => (typeof e === 'number' ? { id: e, source: 'hand' as const } : e));

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
          bans: entries(saved.bans),
          allies: entries(saved.allies),
          enemies: entries(saved.enemies),
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
    if (picked.enemies.length) params.set('enemies', idsOf(picked.enemies).join(','));
    if (picked.allies.length) params.set('allies', idsOf(picked.allies).join(','));
    if (picked.bans.length) params.set('bans', idsOf(picked.bans).join(','));

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
  const applyScanToBoard = applyScanPure;

  /*
   * The scan bridge, if this is the app rather than a browser.
   *
   * Three things happen on the way in, in this order. The callbacks go on
   * `window`, because Kotlin can only call into the page by evaluating a
   * string. The roster goes over, because the matcher needs to know which
   * brawlers exist and the panel already has the list. And then — only then —
   * the page tells the app it is ready, which is what releases any result the
   * app was holding from a scan that finished while the panel was shut.
   *
   * `onPageFinished` is not that signal. The document being loaded says
   * nothing about whether these handlers exist yet, and a result delivered
   * into `window.brawlzone && ...` before they do is silently nothing.
   */
  useEffect(() => {
    const bridge = bridgeOf();
    let preview = false;
    try {
      preview = window.localStorage.getItem(SCAN_PREVIEW) === '1';
    } catch {
      // ignored
    }
    const capable = !!bridge && typeof bridge.ready === 'function';
    if (!capable && !preview) return;

    const api = (window as unknown as { brawlzone?: Record<string, unknown> }).brawlzone ?? {};
    /*
     * The app reports progress as "preparing:42", so the label can count up
     * instead of sitting on "Loading portraits…" for a minute with no sign of
     * whether anything is happening. That silence was itself a bug report.
     */
    api.scanState = (state: string) => {
      const [name, pct] = state.split(':');
      setScanState(name as ScanState);
      setScanProgress(pct ? Number(pct) : null);
    };
    api.scanResult = (payload: ScanPayload) => {
      applyScan(payload);
      // Acknowledged after it is applied, never before: the app keeps a result
      // until this, so a page that dies between the two gets it again.
      if (payload.id !== undefined) {
        try {
          bridge?.ack?.(payload.id);
        } catch {
          // A build without ack retains nothing, so there is nothing to lose.
        }
      }
    };
    (window as unknown as { brawlzone: Record<string, unknown> }).brawlzone = api;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScanOffered(true);
    if (!bridge) return;
    try {
      /*
       * Reading a capability off the host is the "synchronise with an external
       * system" case effects exist for: whether this page is inside the app,
       * and whether capture is already granted, cannot be known during render
       * and must not differ between the server and the first client paint.
       */
      setScanState(bridge.status().split(':')[0] as ScanState);
      bridge.roster(JSON.stringify(roster.map((b) => b.brawlerId)));
      bridge.ready?.();
    } catch {
      setScanState('unsupported');
    }
    // `applyScan` closes over the current board, and re-registering the
    // callbacks on every board change would be a lot of churn for no gain —
    // the ref below is what keeps the handler current instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster]);

  const handleScan = (payload: ScanPayload) => {
    if ((payload.v ?? 1) < 2) {
      setScanNote('This app build is too old to scan with. Update it from the Meta tab.');
      return;
    }
    lastScan.current = payload;
    setLastPayload(payload);

    if (!payload.ok || payload.screen !== 'draft') {
      const why: Record<string, string> = {
        'not-draft': 'That is not the draft screen. Scan with the draft showing.',
        'no-frame': 'The screen could not be captured. Try again.',
        timeout: 'The scan took too long. Try again.',
      };
      setScanNote(why[payload.screen ?? ''] ?? 'Could not read the screen. Is the draft on screen?');
      return;
    }

    const plate = resolvePlate(payload, withMaps);
    /*
     * A different map means a different match, so the board resets. Anything
     * else merges: a scan is one frame of a draft still in progress, and the
     * reader may have typed in a ban the app could not identify. The slots
     * themselves can also say "new draft" — a ban that changed, picks that
     * are empty again — and `applyScan` decides that independently of the map.
     */
    const changedMap = plate.map !== null && map !== null && plate.map.mapName !== map.mapName;
    if (plate.mode !== null) {
      setMode(plate.mode);
      if (plate.map === null) setChanging(true);
    }
    if (plate.map !== null) {
      setMap(plate.map);
      setChanging(false);
    }

    const applied = applyScanToBoard(picked, payload, LIMITS, { newDraft: changedMap });
    setPicked(applied.board);
    if (applied.newDraft) {
      setPicks(null);
      pendingFix.current = null;
    }

    const found = applied.recognized;
    const read = found === 1 ? '1 brawler' : `${found} brawlers`;
    const covered = applied.occluded > 0 ? ' Some slots were under the panel — scan again.' : '';
    const fresh = applied.newDraft ? 'New draft. ' : '';
    const swapped = applied.replaced > 0 ? ` Corrected ${applied.replaced}.` : '';
    const ocr =
      payload.ocr === 'pending'
        ? ' Reading the map…'
        : payload.ocr === 'unavailable'
          ? ' Map reading is not available on this phone yet.'
          : payload.ocr === 'timeout' || payload.ocr === 'failed'
            ? ' The map text could not be read.'
            : '';

    /*
     * Leads with what it read, not with what it wants.
     *
     * "Pick the map below" on its own reads as a refusal — the reader tapped
     * Scan and got an instruction back, with no sign anything happened. Saying
     * the count first makes the same sentence a report with a next step, and it
     * is the only signal that the recognition side is working at all on a map
     * the app has not been taught yet.
     */
    if (plate.map === null && found === 0) {
      setScanNote(`${fresh}Nothing recognised.${covered || ' Scan with the draft screen showing.'}${ocr}`);
    } else if (plate.ambiguous) {
      setScanNote(`${fresh}Read ${read}. Two maps fit the name — pick the right one.${swapped}${covered}`);
    } else if (plate.map === null) {
      setScanNote(`${fresh}Read ${read}. Pick the map — it is remembered for next time.${swapped}${covered}${ocr}`);
    } else if (found === 0) {
      setScanNote(`${fresh}${plate.map.mapName}. No brawlers read — tap them in.${covered}`);
    } else {
      setScanNote(`${fresh}Read ${read} on ${plate.map.mapName}.${swapped}${covered}`);
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
    const bridge = bridgeOf();
    if (!bridge) return;
    setScanNote(null);
    try {
      if (scanState === 'blocked' || scanState === 'consent') return;
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
    const last = lastScan.current;
    if (last && last.id !== undefined && last.ok && last.layout?.plate) {
      try {
        bridgeOf()?.learnPlate(last.id, m.mode ?? mode, m.mapName);
      } catch {
        // A build without the bridge, or one that has since lost the frame.
      }
    }
    /*
     * The board stays. Confirming or correcting the map after a scan is the
     * ordinary way the first scan on any map ends — "read 4 brawlers, pick
     * the map" — and clearing what was just read at that moment threw the
     * scan's whole result away. A map change is a new draft only when the
     * *scan* says so; the reader saying "this is the map" is not.
     *
     * Cleared here rather than in the effect: a new map invalidates the old
     * answer, and that is a consequence of the tap, not of the fetch.
     */
    setPicks(null);
  };

  /* One tap back to an empty board, because the next match is a new draft. */
  const clear = () => {
    setPicked(emptyBoard());
    setPicking(null);
    setPicks(null);
    pendingFix.current = null;
  };

  const add = (slot: Slot, id: number) => {
    setPicked((prev) => {
      // One brawler, one place. A pick cannot also be a ban, and the game
      // would not offer it twice.
      const cleaned: Board = {
        bans: prev.bans.filter((x) => x.id !== id),
        allies: prev.allies.filter((x) => x.id !== id),
        enemies: prev.enemies.filter((x) => x.id !== id),
      };
      if (cleaned[slot].length >= LIMITS[slot]) return cleaned;

      const next: Board = { ...cleaned, [slot]: [...cleaned[slot], { id, source: 'hand' as const }] };

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
   * the correction can be pinned to a screen position in a named scan. Two ways
   * can: the reader removed a scanned entry and is now adding its replacement
   * (the position is the removed entry's), or exactly one position in the
   * strip went unread. Anything else is ambiguous, and a reference learned
   * against the wrong position would be worse than none, because it would
   * score highly against exactly the thing it is wrong about.
   */
  const teach = (slot: Slot, id: number) => {
    const payload = lastScan.current;
    if (!payload || payload.id === undefined) return;

    let index: number | null = null;
    const fix = pendingFix.current;
    if (fix && fix.slot === slot && fix.scanId === payload.id) {
      index = fix.position;
      pendingFix.current = null;
    } else {
      index = correctionIndex(payload[slot]);
    }
    if (index === null) return;

    const bridge = bridgeOf();
    if (!bridge) return;
    try {
      bridge.learn(payload.id, slot, index, id);
      // Recorded, so the same gap is not attributed twice if the reader
      // changes their mind about it.
      const updated = [...slotsOf(payload, slot)];
      updated[index] = { id, status: 'recognized' };
      lastScan.current = { ...payload, [slot]: updated };
    } catch {
      // A build without the bridge, or one that has since lost the frame.
    }
  };

  const remove = (slot: Slot, id: number) =>
    setPicked((prev) => {
      const gone = prev[slot].find((x) => x.id === id);
      if (gone?.source === 'scan' && gone.position !== undefined && gone.scanId !== undefined) {
        pendingFix.current = { slot, position: gone.position, scanId: gone.scanId };
      }
      return { ...prev, [slot]: prev[slot].filter((x) => x.id !== id) };
    });

  const taken = new Set(idsOf([...picked.bans, ...picked.allies, ...picked.enemies]));

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

  const canScan = scanOffered && scanState !== 'unsupported';

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
      ? ['status', 'roster', 'enable', 'scan', 'stop', 'ready', 'ack', 'learn', 'learnPlate', 'openExternal', 'exportDiagnostics']
          .filter((m) => typeof bridge[m] === 'function')
      : [];
    const last = lastPayload;
    const build = Number((window.location.hash.match(/v=(\d+)/) ?? [])[1] ?? 0);
    return [
      `app  ${window.location.hash || '(no version)'}${build && build < MIN_SCAN_BUILD ? ' (too old to scan)' : ''}`,
      `scan ${scanState}`,
      `api  ${bridge ? methods.join(',') : 'absent — not running in the app'}`,
      (() => {
        // The app's own account of the capture session: why it is in the state
        // it is, so a failure on a device nobody here can reproduce arrives as
        // a fact instead of a guess.
        const detail = bridge as unknown as { scanDetail?: () => string };
        try {
          return typeof detail?.scanDetail === 'function' ? `cap  ${detail.scanDetail()}` : '';
        } catch {
          return '';
        }
      })(),
      last
        ? `read #${last.id ?? '?'} ${last.screen ?? '-'} map=${last.map ?? '-'} mode=${last.mode ?? '-'} ocr=${last.ocr ?? '-'} mode-text=${JSON.stringify(last.modeText ?? [])} map-text=${JSON.stringify(last.mapText ?? [])}`
        : 'read (no scan yet)',
      last?.layout
        ? `layout ${last.layout.detected ? 'ok' : 'NOT FOUND'} unit=${last.layout.unit} plate=${last.layout.plate} ${last.layout.reasons?.join('; ') ?? ''}`
        : '',
      last?.self !== undefined && last.self !== null ? `self ally ${last.self + 1}` : '',
      ...(last
        ? (['bans', 'allies', 'enemies'] as const).map(
            (k) =>
              `${k.padEnd(7)} ${slotsOf(last, k)
                .map((s) => (s.status === 'recognized' ? String(s.id) : s.status[0]) + (s.score !== undefined ? `@${s.score}` : ''))
                .join(' ')}`,
          )
        : []),
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
            disabled={
              scanState === 'busy' || scanState === 'preparing' || scanState === 'blocked'
            }
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
            {scanState === 'preparing' && scanProgress !== null ? (
              <span className="tabular-nums opacity-80">{scanProgress}%</span>
            ) : null}
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
            {/*
              The export is the one thing that turns "it read the wrong
              brawler" into something that can be fixed without the phone:
              the exact frame recognition ran on, and its record. Manual, and
              nothing leaves the phone unless the reader picks somewhere.
            */}
            <div className="mt-1 flex gap-1">
              <button
                type="button"
                onClick={() => {
                  try {
                    const out = bridgeOf()?.exportDiagnostics?.();
                    setScanNote(out ? `Export: ${out}` : 'Export needs the app.');
                  } catch {
                    setScanNote('Export failed.');
                  }
                }}
                className="rounded border border-border px-1.5 py-0.5 text-[9px] font-bold text-muted"
              >
                Export last scan
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const n = bridgeOf()?.resetLearned?.();
                    setScanNote(n === undefined ? 'Reset needs the app.' : `Forgot ${n} corrections.`);
                  } catch {
                    setScanNote('Reset failed.');
                  }
                }}
                className="rounded border border-border px-1.5 py-0.5 text-[9px] font-bold text-muted"
              >
                Reset corrections
              </button>
            </div>
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

                {picked[slot].map(({ id, source }) => {
                  const b = byId.get(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => remove(slot, id)}
                      title={`Remove ${b?.brawlerName ?? id}${source === 'scan' ? ' (scanned)' : ''}`}
                    >
                      <Image
                        src={b?.imageUrl ?? ''}
                        alt={b?.brawlerName ?? ''}
                        width={24}
                        height={24}
                        className={`size-6 rounded bg-surface-2 ${
                          slot === 'bans' ? 'opacity-40 grayscale' : ''
                        } ${source === 'scan' ? 'ring-1 ring-accent-2/60' : ''}`}
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
