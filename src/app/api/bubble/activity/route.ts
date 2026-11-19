import type { NextRequest } from 'next/server';

import { getBattleLog } from '@/lib/bs-api';
import { okResponse } from '@/lib/route-helpers';
import { normalizeTag } from '@/lib/tags';

/**
 * "Playing now" for the Bubble app's friends (1.42): when each friend last
 * finished a game, and their last Ranked one, straight from the battle log.
 * The app asks every 15 minutes for up to five friends, shows a green dot
 * for a game in the last 20 minutes and can say "Leo is playing Ranked now".
 *
 *   GET ?tags=TAG1,TAG2 -> { tags: { TAG1: { last, ranked } | null } }
 *
 * Times are the battle log's own ("20261119T151120.000Z"). Two minutes at
 * the edge: friends of the same player ask for the same tags.
 */

export const dynamic = 'force-dynamic';

const RANKED = new Set(['soloRanked', 'teamRanked']);
const MAX = 6;

export async function GET(request: NextRequest) {
  const tags = [...new Set((request.nextUrl.searchParams.get('tags') ?? '').split(',').map((t) => normalizeTag(t)).filter(Boolean))].slice(0, MAX);
  if (tags.length === 0) return Response.json({ error: 'no tags' }, { status: 400 });
  const rows = await Promise.all(
    tags.map(async (tag) => {
      try {
        const items = (await getBattleLog(tag)).items ?? [];
        return [tag, { last: items[0]?.battleTime ?? null, ranked: items.find((e) => RANKED.has(e.battle.type ?? ''))?.battleTime ?? null }] as const;
      } catch {
        return [tag, null] as const;
      }
    }),
  );
  return okResponse({ tags: Object.fromEntries(rows) }, 120);
}
