import { GIVEAWAY_PUBLIC } from '@/lib/giveaway';
import { status } from '@/lib/giveaway-data';

/** GET /api/giveaway/status?code=XXXXXXXX: an entrant's own count. Never the email. */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!GIVEAWAY_PUBLIC) return Response.json(null, { status: 404 });
  const code = new URL(request.url).searchParams.get('code') ?? '';
  const result = await status(code);
  return Response.json(result, { status: result ? 200 : 404, headers: { 'cache-control': 'no-store' } });
}
