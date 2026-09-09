/**
 * Turning what the app read off the screen into a draft the panel understands.
 *
 * The split is deliberate: the Android side reports *what it saw* — raw OCR
 * lines and brawler ids it is confident about — and this decides what that
 * means. The map rotation, the mode labels and the Ranked pool all already live
 * on the web, so a second copy in Kotlin would be a second thing to update
 * every time the rotation turns over, shipping on a different schedule to the
 * thing it has to agree with.
 *
 * Everything here is pure, which is the point: screen recognition is the part
 * of this feature that cannot be tested without a phone and a live match, so
 * the part that *can* be tested is kept separate from it.
 */

/** What the app sends after a scan. Nulls are things it would not guess at. */
export interface ScanPayload {
  ok: boolean;
  /** A mode key the app has been shown before, or null. */
  mode?: string | null;
  /** A map name the app has been shown before, or null. */
  map?: string | null;
  /** Whatever the text recogniser read off the mode plate. */
  text?: string[];
  bans?: (number | null)[];
  allies?: (number | null)[];
  enemies?: (number | null)[];
}

interface NamedMap {
  mapName: string;
}

export interface ResolvedPlate<M extends NamedMap> {
  mode: string | null;
  map: M | null;
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
 * Turns what the app recognised into the panel's own mode and map.
 *
 * An exact lookup, not a fuzzy one, and that is a property of the design rather
 * than a shortcut. The app does not read the map name — it recognises a picture
 * of the plate that the reader themselves confirmed, filed under the name this
 * list gave it. So a returned name either is one of these or is nothing, and
 * there is no third case where it half-matches and the panel has to guess.
 *
 * The mode is answered separately because it is learned separately, and it is
 * learned separately because it is worth much more: eight modes cover every map
 * in the rotation, so a map the reader has never scanned still arrives with its
 * mode chosen and two or three maps to pick between.
 */
export function resolvePlate<M extends NamedMap>(
  payload: ScanPayload,
  modes: { key: string | null; maps: readonly M[] }[],
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

  /*
   * Then the recogniser, for a map this install has never been shown.
   *
   * Second, not first: a learned plate is an exact match on a picture the
   * reader themselves confirmed, so it cannot be wrong about which map it is,
   * whereas this is a best guess at some letters. When both have an opinion the
   * confirmed one wins.
   *
   * Every line is tried against every map rather than assuming the plate's two
   * lines arrive in order — the recogniser groups by layout, and a wrapped mode
   * badge produces three lines. The map is what is matched on: map names are
   * long and nearly unique, mode names are short and several share words.
   */
  if (map === null) {
    const lines = (payload.text ?? []).map(normalise).filter((l) => l.length >= 3);
    let bestScore = 0;
    for (const m of modes) {
      for (const candidate of m.maps) {
        const target = normalise(candidate.mapName);
        for (const line of lines) {
          const score = similarity(line, target);
          if (score >= MIN_SIMILARITY && score > bestScore) {
            bestScore = score;
            map = candidate;
            mode = m.key;
          }
        }
      }
    }
  }

  return { mode, map };
}

/**
 * Merges a reading into the board without taking anything away.
 *
 * Additive on purpose. A scan is one frame of a draft that is still happening,
 * and the reader may well have typed in a ban the app could not identify — so
 * the scan fills gaps and never removes a slot somebody set by hand. Wiping the
 * board is what changing map does, because that is a different match.
 *
 * Ids already placed in another slot are dropped rather than duplicated: a
 * brawler cannot be both banned and picked, and the game would not offer it
 * twice.
 */
export function mergeSlots(
  current: Record<'bans' | 'allies' | 'enemies', number[]>,
  payload: ScanPayload,
  limits: Record<'bans' | 'allies' | 'enemies', number>,
): Record<'bans' | 'allies' | 'enemies', number[]> {
  const next = {
    bans: [...current.bans],
    allies: [...current.allies],
    enemies: [...current.enemies],
  };
  const seen = new Set<number>([...next.bans, ...next.allies, ...next.enemies]);

  for (const slot of ['bans', 'allies', 'enemies'] as const) {
    for (const id of payload[slot] ?? []) {
      if (id === null || id === undefined) continue;
      if (seen.has(id)) continue;
      if (next[slot].length >= limits[slot]) break;
      next[slot].push(id);
      seen.add(id);
    }
  }
  return next;
}

/**
 * Which screen position a correction belongs to, or null when it is ambiguous.
 *
 * The app learns from corrections by storing the pixels it misread against the
 * brawler the reader chose, so attributing one to the wrong position would
 * teach it something false — and a bad reference is worse than no reference,
 * because it scores highly against exactly the thing it is wrong about.
 *
 * So this only answers when there is one gap to fill. Two unread bans and one
 * correction is genuinely ambiguous, and the right response to that is to learn
 * nothing.
 */
export function correctionIndex(read: (number | null)[] | undefined): number | null {
  if (!read) return null;
  const gaps: number[] = [];
  read.forEach((value, index) => {
    if (value === null || value === undefined) gaps.push(index);
  });
  return gaps.length === 1 ? gaps[0] : null;
}
