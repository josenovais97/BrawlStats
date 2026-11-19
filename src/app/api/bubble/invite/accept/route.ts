import type { NextRequest } from 'next/server';

import { accept } from '@/lib/bubble-invite';
import { normalizeTag } from '@/lib/tags';

/**
 * POST {c, tag}: the app that opened an invite says who it is (1.42), so the
 * inviter's app can add them back. Answers with the inviter's tag.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { c?: unknown; tag?: unknown } | null;
  const code = typeof body?.c === 'string' ? body.c.toUpperCase() : '';
  const tag = normalizeTag(typeof body?.tag === 'string' ? body.tag : null);
  if (!code || !tag) return Response.json({ error: 'bad request' }, { status: 400 });
  const from = await accept(code, tag);
  if (!from) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ inviter: from }, { headers: { 'cache-control': 'no-store' } });
}
