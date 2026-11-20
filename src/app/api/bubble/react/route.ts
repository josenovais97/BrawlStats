import type { NextRequest } from 'next/server';

import { isReaction } from '@/lib/bubble-feed-id';
import { react, reactionsAbout, reactionsFor } from '@/lib/bubble-feed';
import { normalizeTag } from '@/lib/tags';

/**
 * Reactions in the Bubble app's squad feed (1.42), see lib/bubble-feed.
 *
 * GET ?posts=id,id,...  everyone's reactions on those posts (at most 60).
 * GET ?about=TAG&since=ms  other players' reactions on posts about TAG.
 * POST {tag, post, r}  sets the player's reaction; r "" removes it.
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const about = normalizeTag(params.get('about'));
  if (about) {
    const since = Number(params.get('since')) || Date.now() - 24 * 60 * 60 * 1000;
    // Never further back than the 30 days anything is kept.
    const from = new Date(Math.max(since, Date.now() - 30 * 24 * 60 * 60 * 1000));
    return Response.json({ about: await reactionsAbout(about, from) }, { headers: NO_STORE });
  }
  const posts = (params.get('posts') ?? '').split(',').filter(Boolean).slice(0, 60);
  return Response.json({ reactions: await reactionsFor(posts) }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { tag?: unknown; post?: unknown; r?: unknown } | null;
  const tag = normalizeTag(typeof body?.tag === 'string' ? body.tag : null);
  const post = typeof body?.post === 'string' ? body.post : '';
  const r = body?.r === '' ? null : isReaction(body?.r) ? body.r : undefined;
  if (!tag || !post || r === undefined) return Response.json({ error: 'bad request' }, { status: 400 });
  const result = await react(post, tag, r);
  if (result === 'busy') return Response.json({ error: 'too many' }, { status: 429 });
  if (result === 'bad') return Response.json({ error: 'refused' }, { status: 400 });
  const reactions = (await reactionsFor([post]))[post] ?? [];
  return Response.json({ reactions }, { headers: NO_STORE });
}
