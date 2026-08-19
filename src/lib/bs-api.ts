import 'server-only';

import { BrawlApiError } from '@/lib/errors';
import { stripGameMarkup } from '@/lib/format';
import { encodeTagForApi, isValidTag } from '@/lib/tags';
import type {
  BSBattleLog,
  BSBrawler,
  BSClub,
  BSClubRanking,
  BSListResponse,
  BSPlayer,
  BSPlayerRanking,
  BSRotationSlot,
} from '@/types/brawlstars';

/**
 * All official-API traffic goes through the RoyaleAPI proxy.
 *
 * The official API whitelists the caller's IP against the key, and Vercel's
 * serverless functions have no stable outbound IP. The proxy has one, so the
 * key is whitelisted against *its* address instead. Same paths, same auth
 * header — only the host differs.
 *
 * The `server-only` import above makes this module a build error if it is ever
 * pulled into a client bundle, which is what keeps the bearer token private.
 */
const API_BASE = process.env.BRAWL_STARS_API_BASE ?? 'https://bsproxy.royaleapi.dev/v1';

/** Live lookups are cached briefly to stay well inside the API rate limit. */
export const REVALIDATE_LIVE = 60;
export const REVALIDATE_SLOW = 120;

const REQUEST_TIMEOUT_MS = 10_000;

interface FetchOptions {
  /** Seconds of ISR caching. */
  revalidate?: number;
  /** Cache tags, so a route can be revalidated on demand. */
  tags?: string[];
}

async function bsFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const key = process.env.BRAWL_STARS_API_KEY;
  if (!key) throw new BrawlApiError('notConfigured');

  const { revalidate = REVALIDATE_LIVE, tags } = options;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate, ...(tags ? { tags } : {}) },
    });
  } catch (err) {
    // Covers DNS failure, connection reset and the abort above.
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new BrawlApiError('timeout');
    }
    throw new BrawlApiError('upstreamDown');
  }

  if (!res.ok) throw mapStatus(res.status);

  return cleanMarkup(await res.json()) as T;
}

/**
 * Player-authored text reaches the site through a dozen different payload
 * shapes — profiles, clubs, members, rankings, every participant of every
 * battle — so the game's colour markup is stripped once here, at the boundary,
 * rather than at each of the places a name is eventually rendered.
 */
function cleanMarkup(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanMarkup);
  if (value === null || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] =
      typeof entry === 'string' && (key === 'name' || key === 'description')
        ? stripGameMarkup(entry)
        : cleanMarkup(entry);
  }
  return out;
}

function mapStatus(status: number): BrawlApiError {
  switch (status) {
    case 400:
      return new BrawlApiError('invalidTag');
    case 401:
    case 403:
      return new BrawlApiError('unauthorized');
    case 404:
      return new BrawlApiError('notFound');
    case 429:
      return new BrawlApiError('rateLimited');
    case 503:
      return new BrawlApiError('upstreamDown');
    default:
      return status >= 500
        ? new BrawlApiError('upstreamDown', undefined, 502)
        : new BrawlApiError('unknown', `Upstream returned ${status}`);
  }
}

/** Rejects malformed tags before spending an API call on them. */
function assertTag(tag: string): string {
  if (!isValidTag(tag)) throw new BrawlApiError('invalidTag');
  return encodeTagForApi(tag);
}

/* --------------------------------- players -------------------------------- */

export function getPlayer(tag: string): Promise<BSPlayer> {
  const t = assertTag(tag);
  return bsFetch<BSPlayer>(`/players/${t}`, {
    revalidate: REVALIDATE_LIVE,
    tags: [`player:${t}`],
  });
}

export function getBattleLog(tag: string): Promise<BSBattleLog> {
  const t = assertTag(tag);
  return bsFetch<BSBattleLog>(`/players/${t}/battlelog`, {
    revalidate: REVALIDATE_LIVE,
    tags: [`battlelog:${t}`],
  });
}

/* ---------------------------------- clubs --------------------------------- */

export function getClub(tag: string): Promise<BSClub> {
  const t = assertTag(tag);
  return bsFetch<BSClub>(`/clubs/${t}`, {
    revalidate: REVALIDATE_LIVE,
    tags: [`club:${t}`],
  });
}

/* -------------------------------- rankings -------------------------------- */

export function getPlayerRankings(
  region = 'global',
  limit = 50,
): Promise<BSListResponse<BSPlayerRanking>> {
  return bsFetch<BSListResponse<BSPlayerRanking>>(
    `/rankings/${encodeURIComponent(region)}/players?limit=${limit}`,
    { revalidate: REVALIDATE_SLOW },
  );
}

export function getClubRankings(
  region = 'global',
  limit = 50,
): Promise<BSListResponse<BSClubRanking>> {
  return bsFetch<BSListResponse<BSClubRanking>>(
    `/rankings/${encodeURIComponent(region)}/clubs?limit=${limit}`,
    { revalidate: REVALIDATE_SLOW },
  );
}

export function getBrawlerRankings(
  brawlerId: number,
  region = 'global',
  limit = 50,
): Promise<BSListResponse<BSPlayerRanking>> {
  return bsFetch<BSListResponse<BSPlayerRanking>>(
    `/rankings/${encodeURIComponent(region)}/brawlers/${brawlerId}?limit=${limit}`,
    { revalidate: REVALIDATE_SLOW },
  );
}

/* --------------------------------- events --------------------------------- */

export function getEventRotation(): Promise<BSRotationSlot[]> {
  return bsFetch<BSRotationSlot[]>('/events/rotation', { revalidate: REVALIDATE_SLOW });
}

/* -------------------------------- brawlers -------------------------------- */

/** Canonical brawler list from the game API. Changes only on game updates. */
export function getOfficialBrawlers(): Promise<BSListResponse<BSBrawler>> {
  return bsFetch<BSListResponse<BSBrawler>>('/brawlers', { revalidate: 86_400 });
}
