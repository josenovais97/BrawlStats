/**
 * Turning what the app read off the screen into a draft the panel understands.
 *
 * The split is deliberate: the Android side reports *what it saw* — raw OCR
 * lines, brawler ids it is confident about, and for every slot *why* it has
 * the answer it has — and this decides what that means. The map rotation, the
 * mode labels and the Ranked pool all already live on the web, so a second
 * copy in Kotlin would be a second thing to update every time the rotation
 * turns over, shipping on a different schedule to the thing it has to agree
 * with.
 *
 * Everything here is pure, which is the point: screen recognition is the part
 * of this feature that cannot be tested without a phone and a live match, so
 * the part that *can* be tested is kept separate from it.
 */

export type Kind = 'bans' | 'allies' | 'enemies';

export const KINDS: readonly Kind[] = ['bans', 'allies', 'enemies'];

/**
 * Why a slot has the answer it has. Four words, not a null, because "nothing"
 * was hiding three different facts: nobody has picked (empty), somebody has
 * and the app cannot name them (unknown), and our own panel was in the frame
 * (occluded). A locked pick that reads empty on a later scan is evidence of a
 * new draft; one that reads unknown is not.
 */
export type SlotStatus = 'recognized' | 'empty' | 'unknown' | 'occluded';

export interface ScanSlot {
  id: number | null;
  status: SlotStatus;
  score?: number;
  margin?: number;
  reason?: string | null;
  top?: { id: number; score: number }[];
}

/** What the app sends after a scan. Nulls are things it would not guess at. */
export interface ScanPayload {
  /** Payload shape. 2 is the first with slot statuses; 1 sent bare ids. */
  v?: number;
  /** The scan this came from. Corrections and acknowledgements name it. */
  id?: number;
  session?: number;
  ok: boolean;
  /** "draft" when the layout was verified; otherwise why it was not. */
  screen?: string;
  reason?: string;
  layout?: {
    detected: boolean;
    confidence: number;
    unit: number;
    plate: boolean;
    reasons: string[];
  };
  /** Which ally card is the reader's own, when the app could tell. */
  self?: number | null;
  /** A mode key the app has been shown before, or null. */
  mode?: string | null;
  /** A map name the app has been shown before, or null. */
  map?: string | null;
  /** Where the text recogniser is with the plate. */
  ocr?: 'pending' | 'done' | 'skipped' | 'unavailable' | 'timeout' | 'failed';
  /** Whatever the text recogniser read off the mode plate, all lines. */
  text?: string[];
  /** The lines on the plate's first line — the mode. */
  modeText?: string[];
  /** The lines on the plate's second line — the map. */
  mapText?: string[];
  bans?: (ScanSlot | number | null)[];
  allies?: (ScanSlot | number | null)[];
  enemies?: (ScanSlot | number | null)[];
}

/** The slots of one kind in the app's own order, whichever payload shape. */
export function slotsOf(payload: ScanPayload, kind: Kind): ScanSlot[] {
  return (payload[kind] ?? []).map((raw) => {
    if (raw !== null && typeof raw === 'object') return raw;
    // Shape 1 sent an id or null, and null meant "empty or uncertain". That
    // ambiguity is the reason shape 2 exists; the kindest reading is unknown.
    return raw === null || raw === undefined
      ? { id: null, status: 'unknown' as const }
      : { id: raw, status: 'recognized' as const };
  });
}

/**
 * One brawler on the board, and how it got there.
 *
 * A scan-sourced entry remembers the screen position it was read from, so a
 * later scan that reads that position differently can replace it — a misread
 * corrects itself on the next tap. A hand-entered one has no position and is
 * never replaced by a scan: the reader typed it in, and the reader wins.
 */
export interface BoardEntry {
  id: number;
  source: 'scan' | 'hand';
  position?: number;
  scanId?: number;
}

export type Board = Record<Kind, BoardEntry[]>;

export const EMPTY_BOARD: Board = { bans: [], allies: [], enemies: [] };

export function idsOf(entries: readonly BoardEntry[]): number[] {
  return entries.map((e) => e.id);
}

export function emptyBoard(): Board {
  return { bans: [], allies: [], enemies: [] };
}

interface NamedMap {
  mapName: string;
}

interface ModeList<M extends NamedMap> {
  key: string | null;
  label?: string;
  maps: readonly M[];
}

export interface ResolvedPlate<M extends NamedMap> {
  mode: string | null;
  map: M | null;
  /**
   * The text matched two maps too closely to choose. The map is left null so
   * the reader picks, rather than the panel picking wrong and re-scoring
   * every suggestion under a map the reader is not on.
   */
  ambiguous: boolean;
}

/**
 * Comparable form of a name.
 *
 * The recogniser gets the letters right and the punctuation wrong: an
 * apostrophe becomes a comma, a hyphen disappears, and spacing follows the
 * kerning rather than the words. Stripping everything that is not a letter or a
 * digit removes the whole class at once, and no two maps in the pool differ
 * only by punctuation.
 */
export function normalise(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Levenshtein, single-row, because these strings are short. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * How alike two names are, 0 to 1.
 *
 * A containment counts as a near-match on purpose: the plate crop is padded so
 * no glyph is clipped, which lets a stray mark from the badge beside the text
 * into the line. "SPIRALINGOUTI" is still Spiraling Out, and an edit-distance
 * ratio alone punishes one extra character far more than it deserves on a short
 * name.
 */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.95;
  return 1 - distance(a, b) / Math.max(a.length, b.length);
}

/**
 * Below this, a "match" is two unrelated words sharing some letters.
 *
 * Set against the shortest names in the pool: at 0.62 a four-letter map name
 * still has to get three of its four characters right, which nothing else in
 * the rotation does. Getting this wrong in the generous direction is the
 * expensive one — a map chosen by mistake changes every number under it,
 * whereas a refusal costs one tap.
 */
export const MIN_SIMILARITY = 0.62;

/**
 * Two candidate maps closer than this are a coin toss, and the panel does not
 * toss coins over which map the reader is on.
 */
export const AMBIGUITY_GAP = 0.1;

/**
 * Turns what the app recognised into the panel's own mode and map.
 *
 * Three sources, in order of trust. A learned plate is an exact match on a
 * picture the reader themselves confirmed, so it cannot be wrong about which
 * map it is. The recogniser's text is a best guess at some letters. And the
 * mode is answered separately from the map because it is worth much more
 * on its own: eight modes cover every map in the rotation, so a map the
 * reader has never scanned still arrives with its mode chosen and two or
 * three maps to pick between.
 *
 * The plate has two lines — mode above map — and the app reports them
 * separately. The mode is matched against the mode labels and the map only
 * against maps *in that mode*, which is what stops "Hard Rock Mine" being
 * offered under Brawl Ball because a Gem Grab map's letters happened to be
 * closer. When the app could not split the lines, every line is tried against
 * everything, as before.
 */
export function resolvePlate<M extends NamedMap>(
  payload: ScanPayload,
  modes: ModeList<M>[],
): ResolvedPlate<M> {
  let mode: string | null = null;
  let map: M | null = null;

  if (payload.map) {
    for (const m of modes) {
      const found = m.maps.find((x) => x.mapName === payload.map);
      if (found) {
        map = found;
        mode = m.key;
        break;
      }
    }
  }
  if (map === null && payload.mode) {
    const found = modes.find((m) => m.key === payload.mode);
    if (found) mode = found.key;
  }
  if (map !== null) return { mode, map, ambiguous: false };

  const clean = (lines: string[] | undefined) =>
    (lines ?? []).map(normalise).filter((l) => l.length >= 3);
  const split = (payload.modeText?.length ?? 0) + (payload.mapText?.length ?? 0) > 0;
  const modeLines = split ? clean(payload.modeText) : clean(payload.text);
  const mapLines = split ? clean(payload.mapText) : clean(payload.text);

  // The mode, from its own line and its own list.
  if (mode === null) {
    let best = 0;
    for (const m of modes) {
      if (m.key === null || !m.label) continue;
      const target = normalise(m.label);
      for (const line of modeLines) {
        const score = similarity(line, target);
        if (score >= MIN_SIMILARITY && score > best) {
          best = score;
          mode = m.key;
        }
      }
    }
  }

  // The map, from within the mode when one is known.
  const pool = mode !== null ? modes.filter((m) => m.key === mode) : modes;
  let best = 0;
  let second = 0;
  let bestMap: M | null = null;
  let bestMode: string | null = null;
  for (const m of pool) {
    for (const candidate of m.maps) {
      const target = normalise(candidate.mapName);
      let own = 0;
      for (const line of mapLines) own = Math.max(own, similarity(line, target));
      if (own > best) {
        second = best;
        best = own;
        bestMap = candidate;
        bestMode = m.key;
      } else if (own > second) {
        second = own;
      }
    }
  }
  if (bestMap !== null && best >= MIN_SIMILARITY) {
    if (second >= MIN_SIMILARITY && best - second < AMBIGUITY_GAP) {
      return { mode, map: null, ambiguous: true };
    }
    return { mode: bestMode ?? mode, map: bestMap, ambiguous: false };
  }
  return { mode, map: null, ambiguous: false };
}

export interface Applied {
  board: Board;
  /** The scan showed a draft other than the one on the board. */
  newDraft: boolean;
  /** Why it was called a new draft, for the note. */
  newDraftReason: string | null;
  recognized: number;
  unknown: number;
  occluded: number;
  empty: number;
  /** Scan-sourced entries replaced because the same position now reads differently. */
  replaced: number;
}

/**
 * Whether this reading is of a different draft from the one on the board.
 *
 * Independent of the map. Two drafts in a row on the same map are ordinary
 * in Ranked, and the map changing is only one of the ways a new draft shows.
 * The others are in the slots: bans are locked for the whole draft, so a ban
 * position that now reads a *different* brawler is a different draft; and a
 * locked pick never becomes the empty placeholder again within one draft, so
 * pick positions that were recognised and now read empty are a board that
 * has been cleared for the next match.
 *
 * Only scan-sourced entries are evidence. The reader may have typed a pick
 * into a slot the app never read, and that says nothing about positions.
 */
export function detectNewDraft(
  board: Board,
  payload: ScanPayload,
): { newDraft: boolean; reason: string | null } {
  if (!payload.ok || payload.screen !== 'draft') return { newDraft: false, reason: null };

  const bans = slotsOf(payload, 'bans');
  for (const entry of board.bans) {
    if (entry.source !== 'scan' || entry.position === undefined) continue;
    const now = bans[entry.position];
    if (now && now.status === 'recognized' && now.id !== null && now.id !== entry.id) {
      return { newDraft: true, reason: 'a ban changed' };
    }
  }

  let known = 0;
  let wentEmpty = 0;
  for (const kind of ['allies', 'enemies'] as const) {
    const slots = slotsOf(payload, kind);
    for (const entry of board[kind]) {
      if (entry.source !== 'scan' || entry.position === undefined) continue;
      const now = slots[entry.position];
      if (!now) continue;
      known += 1;
      if (now.status === 'empty') wentEmpty += 1;
    }
  }
  if (wentEmpty >= 2 || (wentEmpty >= 1 && wentEmpty === known)) {
    return { newDraft: true, reason: 'picked slots are empty again' };
  }
  return { newDraft: false, reason: null };
}

/**
 * Merges a reading into the board.
 *
 * Additive within a draft. A scan is one frame of a draft that is still
 * happening, and the reader may well have typed in a ban the app could not
 * identify — so a recognised slot fills a gap, an unknown or occluded slot
 * changes nothing, and nothing the reader set by hand is ever removed. The
 * one subtraction is a scan-sourced entry whose own screen position now reads
 * as a different brawler: that was a misread, and the newer reading replaces
 * it in place.
 *
 * A new draft — by the map, or by the slots, see `detectNewDraft` — starts
 * from an empty board. That is the only time a hand-entered pick goes.
 *
 * The reader's own card is not an ally. The board's two ally slots are the
 * team-mates the scoring wants; feeding the reader's own pick in as one takes
 * a slot and tilts every suggestion toward what they already have.
 */
export function applyScan(
  current: Board,
  payload: ScanPayload,
  limits: Record<Kind, number>,
  options: { newDraft?: boolean } = {},
): Applied {
  const counts = { recognized: 0, unknown: 0, occluded: 0, empty: 0 };
  if (!payload.ok || payload.screen !== 'draft') {
    return { board: current, newDraft: false, newDraftReason: null, ...counts, replaced: 0 };
  }

  const detected = detectNewDraft(current, payload);
  const newDraft = options.newDraft === true || detected.newDraft;
  const reason = options.newDraft ? 'the map changed' : detected.reason;
  const base: Board = newDraft ? emptyBoard() : current;

  const next: Board = {
    bans: [...base.bans],
    allies: [...base.allies],
    enemies: [...base.enemies],
  };
  const where = new Map<number, Kind>();
  for (const kind of KINDS) for (const e of next[kind]) where.set(e.id, kind);

  let replaced = 0;
  const self = payload.self ?? null;

  for (const kind of KINDS) {
    const slots = slotsOf(payload, kind);
    slots.forEach((slot, position) => {
      counts[slot.status] += 1;
      if (kind === 'allies' && position === self) return;
      if (slot.status !== 'recognized' || slot.id === null) return;
      const id = slot.id;

      const at = next[kind].findIndex((e) => e.source === 'scan' && e.position === position);
      if (at >= 0) {
        const old = next[kind][at];
        if (old.id === id) {
          next[kind][at] = { ...old, scanId: payload.id };
          return;
        }
        // The same position, a different answer: the old one was a misread.
        // Unless the new id is already on the board somewhere the reader put
        // it, in which case the stale entry simply goes.
        where.delete(old.id);
        if (where.has(id)) {
          next[kind].splice(at, 1);
        } else {
          next[kind][at] = { id, source: 'scan', position, scanId: payload.id };
          where.set(id, kind);
        }
        replaced += 1;
        return;
      }

      // One brawler, one place. A pick cannot also be a ban, and the game
      // would not offer it twice.
      if (where.has(id)) return;
      if (next[kind].length >= limits[kind]) return;
      next[kind].push({ id, source: 'scan', position, scanId: payload.id });
      where.set(id, kind);
    });
  }

  return { board: next, newDraft, newDraftReason: newDraft ? reason : null, ...counts, replaced };
}

/**
 * Which screen position a correction belongs to, or null when it is ambiguous.
 *
 * The app learns from corrections by storing the pixels it misread against the
 * brawler the reader chose, so attributing one to the wrong position would
 * teach it something false — and a bad reference is worse than no reference,
 * because it scores highly against exactly the thing it is wrong about.
 *
 * So this only answers when there is one *unknown* position to fill. Empty
 * and occluded positions are not candidates: there is nothing there to have
 * misread. Two unknown bans and one correction is genuinely ambiguous, and the
 * right response to that is to learn nothing.
 */
export function correctionIndex(read: (ScanSlot | number | null)[] | undefined): number | null {
  if (!read) return null;
  const gaps: number[] = [];
  read.forEach((raw, index) => {
    const slot: ScanSlot =
      raw !== null && typeof raw === 'object'
        ? raw
        : { id: raw ?? null, status: raw === null || raw === undefined ? 'unknown' : 'recognized' };
    if (slot.status === 'unknown') gaps.push(index);
  });
  return gaps.length === 1 ? gaps[0] : null;
}

/**
 * The old signature, kept for the older payload shape: merges bare ids as
 * recognised slots and never removes anything.
 */
export function mergeSlots(
  current: Record<Kind, number[]>,
  payload: ScanPayload,
  limits: Record<Kind, number>,
): Record<Kind, number[]> {
  const board: Board = {
    bans: current.bans.map((id) => ({ id, source: 'hand' as const })),
    allies: current.allies.map((id) => ({ id, source: 'hand' as const })),
    enemies: current.enemies.map((id) => ({ id, source: 'hand' as const })),
  };
  const applied = applyScan(board, { ...payload, screen: payload.screen ?? 'draft' }, limits);
  return {
    bans: idsOf(applied.board.bans),
    allies: idsOf(applied.board.allies),
    enemies: idsOf(applied.board.enemies),
  };
}
