import { GIVEAWAY } from '@/lib/giveaway';
import { SITE_URL, USER_AGENT } from '@/lib/site';

/**
 * The giveaway's outcome, once the owner publishes it (2026-11-25):
 * deploy/bin/brawlzone-giveaway-publish writes /social/giveaway/result.json
 * from the draw's private proof. A file and not the repo, which is public and
 * remembers: a player who asks to be taken off the list can be.
 */
export interface GiveawayResult {
  winner: { name: string; tag: string | null };
  /** The ticket that won, counted from 1. */
  ticket: number;
  tickets: number;
  entrants: number;
  round: number;
  randomness: string;
  digest: string;
  video: string | null;
  /** In the order of the draw, with the tickets each held. */
  list: { tag: string; points: number; from: number; to: number }[];
  /** Whose ticket it was: an index into `list`. */
  winnerRow: number;
}

const HEX64 = /^[0-9a-f]{64}$/;

/** The file as a result, or null for anything that does not add up. */
export function parseGiveawayResult(raw: unknown): GiveawayResult | null {
  const r = raw as {
    giveaway?: unknown; winner?: { name?: unknown; tag?: unknown }; ticket?: unknown; tickets?: unknown; round?: unknown;
    randomness?: unknown; digest?: unknown; video?: unknown; list?: unknown;
  } | null;
  if (!r || r.giveaway !== GIVEAWAY.id || !Array.isArray(r.list)) return null;
  const name = typeof r.winner?.name === 'string' ? r.winner.name.trim() : '';
  if (!name || name.length > 40) return null;
  if (typeof r.randomness !== 'string' || !HEX64.test(r.randomness) || typeof r.digest !== 'string' || !HEX64.test(r.digest)) return null;

  let at = 0;
  const list: GiveawayResult['list'] = [];
  for (const row of r.list) {
    if (!Array.isArray(row) || typeof row[0] !== 'string' || !Number.isInteger(row[1]) || row[1] < 1) return null;
    list.push({ tag: row[0], points: row[1], from: at + 1, to: at + row[1] });
    at += row[1];
  }
  const { ticket, round } = r;
  if (r.tickets !== at || typeof ticket !== 'number' || !Number.isInteger(ticket) || ticket < 1 || ticket > at) return null;
  if (typeof round !== 'number' || !Number.isInteger(round) || round < 1) return null;
  const winnerRow = list.findIndex((x) => ticket >= x.from && ticket <= x.to);
  const tag = typeof r.winner?.tag === 'string' && r.winner.tag ? r.winner.tag : null;
  if (tag && list[winnerRow].tag !== tag) return null;
  const video = typeof r.video === 'string' && /^https:\/\/[^\s"<>]+$/.test(r.video) ? r.video : null;
  return { winner: { name, tag }, ticket, tickets: at, entrants: list.length, round, randomness: r.randomness, digest: r.digest, video, list, winnerRow };
}

/** The published result, or null until there is one. */
export async function getGiveawayResult(): Promise<GiveawayResult | null> {
  try {
    const res = await fetch(`${SITE_URL}/social/giveaway/result.json`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 300 },
    });
    return res.ok ? parseGiveawayResult(await res.json()) : null;
  } catch {
    return null;
  }
}
