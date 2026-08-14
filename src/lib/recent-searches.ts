/**
 * Recently looked-up tags, kept in localStorage.
 *
 * Nobody remembers their own tag, let alone a friend's, so every successful
 * lookup is remembered on the device. This is deliberately client-only and
 * anonymous: nothing is sent to the server, and clearing it is one click.
 */

export type RecentKind = 'player' | 'club';

export interface RecentSearch {
  kind: RecentKind;
  /** Normalised, without the leading "#". */
  tag: string;
  name?: string;
  /** Epoch milliseconds of the most recent visit. */
  at: number;
}

const STORAGE_KEY = 'brawlstats:recent-searches';
const MAX_ENTRIES = 10;

/** Fired on the window so open components refresh without prop drilling. */
export const RECENT_SEARCHES_EVENT = 'brawlstats:recent-searches-changed';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** Stable empty array — `useSyncExternalStore` compares snapshots by reference. */
const EMPTY: RecentSearch[] = [];

let cachedRaw: string | null = null;
let cachedValue: RecentSearch[] = EMPTY;

export function readRecentSearches(): RecentSearch[] {
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
        (entry): entry is RecentSearch =>
          !!entry &&
          typeof entry === 'object' &&
          typeof (entry as RecentSearch).tag === 'string' &&
          ((entry as RecentSearch).kind === 'player' ||
            (entry as RecentSearch).kind === 'club'),
      )
      .slice(0, MAX_ENTRIES);
    return cachedValue;
  } catch {
    return EMPTY;
  }
}

/** Server render has no storage, so it always starts empty. */
export function serverRecentSearches(): RecentSearch[] {
  return EMPTY;
}

export function subscribeRecentSearches(onChange: () => void): () => void {
  window.addEventListener(RECENT_SEARCHES_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(RECENT_SEARCHES_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function write(entries: RecentSearch[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    cachedRaw = null;
    window.dispatchEvent(new Event(RECENT_SEARCHES_EVENT));
  } catch {
    // Quota exceeded or storage disabled — recents are a convenience, not a
    // feature worth breaking a page over.
  }
}

/** Adds or refreshes an entry, moving it to the front. */
export function addRecentSearch(entry: Omit<RecentSearch, 'at'>) {
  const existing = readRecentSearches().filter(
    (e) => !(e.kind === entry.kind && e.tag === entry.tag),
  );
  write([{ ...entry, at: Date.now() }, ...existing]);
}

export function removeRecentSearch(kind: RecentKind, tag: string) {
  write(readRecentSearches().filter((e) => !(e.kind === kind && e.tag === tag)));
}

export function clearRecentSearches() {
  write([]);
}
