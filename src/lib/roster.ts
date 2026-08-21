/**
 * Which brawlers you own, kept in your own browser.
 *
 * The draft helper used to recommend from the whole roster, which is only the
 * right answer for someone who has everything. A Ranked draft is chosen from
 * what you actually have, and the site already knows that the moment you look
 * yourself up — it is on the screen. Remembering it locally turns a general
 * tool into a personal one with no account and no server-side record.
 *
 * Ids only, and no more than a few profiles' worth, so the entry stays a few
 * hundred bytes. Same trade as `player-history`: clearing browser data loses
 * it, which is acceptable for a convenience that belongs to one device.
 *
 * Shaped as an external store — a cached read, a server snapshot and a
 * subscription — because that is what `useSyncExternalStore` wants and what
 * `lib/favorites` already does. Reading localStorage in an effect and calling
 * `setState` would work and is what this originally did; it also cascades a
 * render and makes the hydration snapshot a lie.
 */

export interface StoredRoster {
  /** Normalised, no "#". */
  tag: string;
  name: string;
  /** Epoch milliseconds this was recorded. */
  at: number;
  /** Every brawler the account has unlocked. */
  owned: number[];
  /** The subset at power 11, which is what Ranked above Mythic requires. */
  power11: number[];
}

const STORAGE_KEY = 'brawlstats:rosters';
const ROSTER_EVENT = 'brawlstats:rosters-changed';

/** More than one account per device is normal; a dozen is not. */
const MAX_ENTRIES = 5;
const MAX_AGE_MS = 90 * 86_400_000;

const EMPTY: StoredRoster[] = [];

/*
 * `useSyncExternalStore` compares snapshots by identity, so parsing on every
 * call would loop forever. The raw string is the cache key.
 */
let cachedRaw: string | null = null;
let cachedValue: StoredRoster[] = EMPTY;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isRoster(entry: unknown, cutoff: number): entry is StoredRoster {
  if (!entry || typeof entry !== 'object') return false;
  const value = entry as Partial<StoredRoster>;
  return (
    typeof value.tag === 'string' &&
    typeof value.name === 'string' &&
    typeof value.at === 'number' &&
    value.at > cutoff &&
    Array.isArray(value.owned) &&
    Array.isArray(value.power11)
  );
}

/** Every remembered roster, newest first. */
export function readRosters(): StoredRoster[] {
  if (!isBrowser()) return EMPTY;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    if (raw === cachedRaw) return cachedValue;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;

    // Storage is user-writable, so validate rather than trust the shape.
    const cutoff = Date.now() - MAX_AGE_MS;
    cachedRaw = raw;
    cachedValue = parsed
      .filter((entry): entry is StoredRoster => isRoster(entry, cutoff))
      .sort((a, b) => b.at - a.at);
    return cachedValue;
  } catch {
    // Corrupt or unreadable storage is the same as no storage.
    return EMPTY;
  }
}

/** There is no localStorage on the server, and pretending otherwise breaks hydration. */
export function serverRosters(): StoredRoster[] {
  return EMPTY;
}

/** Subscribes to changes from this tab and from other tabs. */
export function subscribeRosters(onChange: () => void): () => void {
  window.addEventListener(ROSTER_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(ROSTER_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function saveRoster(entry: Omit<StoredRoster, 'at'>): void {
  if (!isBrowser()) return;
  try {
    const rest = readRosters().filter((stored) => stored.tag !== entry.tag);
    const next = [{ ...entry, at: Date.now() }, ...rest].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(ROSTER_EVENT));
  } catch {
    // A full or disabled store is not worth surfacing: the feature it powers
    // is a convenience, and every page works without it.
  }
}

export function clearRosters(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(ROSTER_EVENT));
  } catch {
    /* nothing to do */
  }
}
