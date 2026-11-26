import type { NextRequest } from 'next/server';

import { draftChanceFor } from '@/lib/bubble-review';
import { bracketBySlug } from '@/lib/rank-brackets';
import { okResponse } from '@/lib/route-helpers';

/**
 * The draft board's live chance (Bubble 1.43, 2026-11-23).
 *
 * GET ?map=<name>&mine=1,2,3&theirs=4,5,6 → { chance, mapped }, the draft's
 * chance to win on that map from the same reading as the post-game review.
 * `mine` is the reader's team (teammates plus the pick being tried). `rank`
 * (a bracket slug, optional, 2026-11-26) reads that rank's games, as the
 * draft suggestions do. Answers are the same for everyone, so they are cached
 * by URL at the edge.
 */
export const dynamic = 'force-dynamic';

function ids(raw: string | null): number[] | null {
  if (!raw) return [];
  const out = raw.split(',').map((x) => Number(x));
  if (out.length > 3 || out.some((n) => !Number.isInteger(n) || n < 16_000_000 || n > 16_999_999)) return null;
  return [...new Set(out)];
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const map = (q.get('map') ?? '').trim();
  const mine = ids(q.get('mine'));
  const theirs = ids(q.get('theirs'));
  if (!map || map.length > 60 || !mine || !theirs) {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }
  const bracket = bracketBySlug(q.get('rank'))?.id;
  const read = await draftChanceFor(map, mine, theirs, bracket).catch(() => null);
  return okResponse({ chance: read?.chance ?? null, mapped: read?.mapped ?? 0 }, 600);
}
