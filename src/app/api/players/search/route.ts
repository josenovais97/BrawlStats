import { searchPlayersByName } from '@/lib/player-search';

/**
 * GET /api/players/search?q=<name>: up to eight players whose name contains
 * q (lib/player-search). Three small tables and a scan each, so cheap; `/api/`
 * is closed to crawlers and Cloudflare's per-IP limit sits in front.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  const players = await searchPlayersByName(q).catch(() => []);
  return Response.json({ players }, { headers: { 'cache-control': 'public, max-age=60' } });
}
