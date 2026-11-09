import { playerIconUrl } from '@/lib/brawlapi';
import { searchPlayersByName } from '@/lib/player-search';
import { SITE_URL } from '@/lib/site';

/**
 * GET /api/players/search?q=<name>: up to eight players whose name contains
 * q (lib/player-search). Three small tables and a scan each, so cheap; `/api/`
 * is closed to crawlers and Cloudflare's per-IP limit sits in front.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  const found = await searchPlayersByName(q).catch(() => []);
  // `iconUrl` as a full address for the Bubble app's name search (2026-11-09); the site builds its own from iconId.
  const players = found.map((p) => {
    const icon = playerIconUrl(p.iconId ?? undefined);
    return { ...p, iconUrl: icon ? (icon.startsWith('http') ? icon : `${SITE_URL}${icon.startsWith('/') ? '' : '/'}${icon}`) : null };
  });
  return Response.json({ players }, { headers: { 'cache-control': 'public, max-age=60' } });
}
