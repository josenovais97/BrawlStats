/**
 * Saved players and clubs, kept in localStorage.
 *
 * Distinct from recent searches: recents are automatic and capped at 10 with
 * oldest-out eviction, while favourites are an explicit choice and are never
 * evicted behind the user's back. Both are device-local and anonymous.
 */

export type FavoriteKind = 'player' | 'club';

export interface Favorite {
  kind: FavoriteKind;
  /** Normalised, without the leading "#". */
  tag: string;
  name?: string;
  /** Epoch milliseconds when it was saved. */
  at: number;
}

const STORAGE_KEY = 'brawlzone:favorites';

/**
 * A generous ceiling that exists only to stop unbounded growth. Anyone hitting
 * it is well past normal use, and the oldest entry is dropped rather than
 * silently failing to save.
 */
const MAX_ENTRIES = 50;

export const FAVORITES_EVENT = 'brawlzone:favorites-changed';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Stable empty array. `useSyncExternalStore` compares snapshots by reference,
 * so returning a fresh `[]` each call would loop forever.
 */
const EMPTY: Favorite[] = [];

/** Last raw string parsed, so repeat snapshots reuse the same array instance. */
let cachedRaw: string | null = null;
let cachedValue: Favorite[] = EMPTY;

export function readFavorites(): Favorite[] {
  if (!isBrowser()) return EMPTY;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    if (raw === cachedRaw) return cachedValue;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;

    // Storage is user-writable, so validate rather than trust the shape.
    cachedRaw = raw;
    cachedValue = parsed
      .filter(
        (entry): entry is Favorite =>
          !!entry &&
          typeof entry === 'object' &&
          typeof (entry as Favorite).tag === 'string' &&
          ((entry as Favorite).kind === 'player' || (entry as Favorite).kind === 'club'),
      )
      .slice(0, MAX_ENTRIES);
    return cachedValue;
  } catch {
    return EMPTY;
  }
}

/** Server render has no storage, so it always starts empty. */
export function serverFavorites(): Favorite[] {
  return EMPTY;
}

/** Subscribes to changes from this tab and from other tabs. */
export function subscribeFavorites(onChange: () => void): () => void {
  window.addEventListener(FAVORITES_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(FAVORITES_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function write(entries: Favorite[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    // Invalidate the snapshot cache so subscribers read the new value.
    cachedRaw = null;
    window.dispatchEvent(new Event(FAVORITES_EVENT));
  } catch {
    // Quota exceeded or storage disabled — favourites are a convenience.
  }
}

export function isFavorite(kind: FavoriteKind, tag: string): boolean {
  return readFavorites().some((f) => f.kind === kind && f.tag === tag);
}

export function addFavorite(entry: Omit<Favorite, 'at'>) {
  const existing = readFavorites().filter(
    (f) => !(f.kind === entry.kind && f.tag === entry.tag),
  );
  write([{ ...entry, at: Date.now() }, ...existing]);
}

export function removeFavorite(kind: FavoriteKind, tag: string) {
  write(readFavorites().filter((f) => !(f.kind === kind && f.tag === tag)));
}

/** Adds or removes, returning the state after the change. */
export function toggleFavorite(entry: Omit<Favorite, 'at'>): boolean {
  if (isFavorite(entry.kind, entry.tag)) {
    removeFavorite(entry.kind, entry.tag);
    return false;
  }
  addFavorite(entry);
  return true;
}

export function clearFavorites() {
  write([]);
}
