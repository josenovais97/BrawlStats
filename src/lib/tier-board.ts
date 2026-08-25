import { TIER_ORDER } from '@/lib/tiers';
import type { Tier } from '@/types/stats';

/**
 * The share-link format for the tier list maker, both directions in one place.
 *
 * One parameter per tier — `?s=4.11&a=1.5` — holding short brawler ids in
 * placement order. Short because the full ids all begin with the same eight
 * digits, and a link that has to survive being pasted into a chat app should
 * not spend a hundred characters saying "16000000" over and over.
 *
 * Encode and decode live together because they are one format: a change to
 * either that the other does not match silently breaks every link already out
 * there, and those links are the only place a board is ever stored.
 *
 * Deliberately dependency-free and free of `server-only`, because this now runs
 * in the browser. It used to be decoded on the server, which meant the maker
 * read `searchParams` and so re-rendered per request — for a page whose entire
 * state is in the URL and whose board is client-side anyway.
 */

/** Ids are stored relative to this, which every brawler id starts from. */
const ID_BASE = 16_000_000;

/**
 * Reads a board out of a share link.
 *
 * Everything is validated against the real catalogue rather than trusted: the
 * parameter is user-editable, so an unknown id is dropped rather than rendered
 * as a broken tile.
 */
export function decodeBoard(
  params: URLSearchParams,
  known: Set<number>,
): Record<number, Tier> {
  const board: Record<number, Tier> = {};

  for (const tier of TIER_ORDER) {
    const value = params.get(tier.toLowerCase());
    if (!value) continue;

    for (const part of value.split('.')) {
      const id = ID_BASE + Number(part);
      if (!Number.isFinite(id) || !known.has(id)) continue;
      // First tier wins, so a hand-edited link listing an id twice cannot put
      // one brawler in two rows.
      if (board[id] === undefined) board[id] = tier;
    }
  }

  return board;
}

/** The order ids appear in, so a decoded board keeps its placement order. */
export function decodeOrder(
  params: URLSearchParams,
  known: Set<number>,
): number[] {
  const seen = new Set<number>();
  const order: number[] = [];

  for (const tier of TIER_ORDER) {
    const value = params.get(tier.toLowerCase());
    if (!value) continue;
    for (const part of value.split('.')) {
      const id = ID_BASE + Number(part);
      if (!Number.isFinite(id) || !known.has(id) || seen.has(id)) continue;
      seen.add(id);
      order.push(id);
    }
  }

  return order;
}

/** Writes a board into the query string of a share link. */
export function encodeBoard(rows: Record<Tier, { id: number }[]>): string {
  const params = new URLSearchParams();
  for (const tier of TIER_ORDER) {
    const ids = rows[tier].map((brawler) => brawler.id - ID_BASE);
    if (ids.length > 0) params.set(tier.toLowerCase(), ids.join('.'));
  }
  return params.toString();
}
