/**
 * A snapshot of each profile you have looked at, kept in your own browser.
 *
 * This is what lets a profile open with "+842 trophies since your last visit"
 * without the site storing anything about anyone. Every value is already on
 * screen when the snapshot is taken, so nothing new is collected — it is the
 * same numbers, remembered locally so they can be subtracted next time.
 *
 * Deliberately localStorage rather than a database. A server-side history
 * would mean a table keyed by player tag growing forever, which is a real cost
 * for a feature whose whole value is personal to one device. Clearing browser
 * data loses it, and that is an acceptable trade for €0 and no account.
 */

export interface PlayerSnapshot {
  /** Epoch milliseconds the snapshot was taken. */
  at: number;
  trophies: number;
  brawlers: number;
  power11: number;
  hyperCharges: number;
  /** Skill score out of 10, one decimal. */
  skill: number;
}

export interface PlayerDelta {
  /** Days between the two snapshots, rounded. */
  days: number;
  trophies: number;
  brawlers: number;
  power11: number;
  hyperCharges: number;
  skill: number;
  /** True when every tracked value is unchanged. */
  unchanged: boolean;
}

const STORAGE_KEY = 'brawlstats:player-snapshots';

/**
 * How many profiles to remember, and for how long.
 *
 * Bounded on both axes so the entry can never grow without limit: someone who
 * looks up two hundred tags keeps the most recent thirty, and a snapshot older
 * than three months is dropped rather than producing a "since your last visit"
 * covering a season nobody remembers.
 */
const MAX_ENTRIES = 30;
const MAX_AGE_MS = 90 * 86_400_000;

/** Below this the comparison is noise from the same session. */
const MIN_GAP_MS = 30 * 60_000;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

type Store = Record<string, PlayerSnapshot>;

function readStore(): Store {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const cutoff = Date.now() - MAX_AGE_MS;
    const out: Store = {};
    for (const [tag, value] of Object.entries(parsed as Store)) {
      // Anything malformed or stale is dropped on read, so a corrupted entry
      // heals itself on the next visit rather than throwing forever.
      if (
        value &&
        typeof value.at === 'number' &&
        typeof value.trophies === 'number' &&
        value.at > cutoff
      ) {
        out[tag] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/*
 * Cached by tag so the reference is stable.
 *
 * `useSyncExternalStore` compares snapshots by identity, so returning a freshly
 * parsed object on every call would re-render forever. The value cannot change
 * while a profile is open — it is written once, on arrival — so caching the
 * first read for the lifetime of the page is both safe and sufficient.
 */
const snapshotCache = new Map<string, PlayerSnapshot | null>();

/** The snapshot from a previous visit, if one is old enough to be interesting. */
export function readSnapshot(tag: string): PlayerSnapshot | null {
  const cached = snapshotCache.get(tag);
  if (cached !== undefined) return cached;

  const stored = readStore()[tag];
  const value = stored && Date.now() - stored.at >= MIN_GAP_MS ? stored : null;
  snapshotCache.set(tag, value);
  return value;
}

/** No-op subscribe: nothing mutates this within a page view. */
export function subscribeSnapshot(): () => void {
  return () => {};
}

/**
 * Records the current state, evicting the oldest entries past the cap.
 *
 * Called after the delta has been computed, so writing does not destroy the
 * comparison the reader is looking at.
 */
export function writeSnapshot(tag: string, snapshot: PlayerSnapshot): void {
  if (!isBrowser()) return;

  try {
    const store = readStore();
    store[tag] = snapshot;

    const entries = Object.entries(store).sort((a, b) => b[1].at - a[1].at);
    const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES));

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // A full or disabled localStorage costs the feature, never the page.
  }
}

/** Difference between a stored snapshot and now. */
export function diffSnapshot(
  previous: PlayerSnapshot,
  current: Omit<PlayerSnapshot, 'at'>,
): PlayerDelta {
  const delta: PlayerDelta = {
    days: Math.max(1, Math.round((Date.now() - previous.at) / 86_400_000)),
    trophies: current.trophies - previous.trophies,
    brawlers: current.brawlers - previous.brawlers,
    power11: current.power11 - previous.power11,
    hyperCharges: current.hyperCharges - previous.hyperCharges,
    skill: Number((current.skill - previous.skill).toFixed(1)),
    unchanged: false,
  };

  delta.unchanged =
    delta.trophies === 0 &&
    delta.brawlers === 0 &&
    delta.power11 === 0 &&
    delta.hyperCharges === 0 &&
    delta.skill === 0;

  return delta;
}
