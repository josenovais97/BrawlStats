import type { NextRequest } from 'next/server';

import { accepted } from '@/lib/bubble-invite';

/** GET ?c=CODE: who opened this invite in the app (1.42), for the inviter's hourly check. */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const code = (request.nextUrl.searchParams.get('c') ?? '').toUpperCase();
  const tags = await accepted(code);
  return Response.json({ tags }, { headers: { 'cache-control': 'no-store' } });
}
