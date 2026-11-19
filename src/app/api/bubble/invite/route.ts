import type { NextRequest } from 'next/server';

import { playerIconUrl, rankedTierIconUrl } from '@/lib/brawlapi';
import { getPlayer } from '@/lib/bs-api';
import { appNames, localRank } from '@/lib/bubble-app-l10n';
import { CODE, inviteCode, inviter } from '@/lib/bubble-invite';
import { isOptedOut } from '@/lib/opted-out';
import { RANK_ELO_FLOORS, rankProgress } from '@/lib/ranked-elo';
import { SITE_URL } from '@/lib/site';
import { normalizeTag } from '@/lib/tags';

/**
 * Friend invites (1.42), see lib/bubble-invite.
 *
 *   POST {tag}      -> {code}: the inviting player's code (the same one every time)
 *   GET  ?c=CODE    -> who invited: tag, name, icon, rank (the landing page and the app)
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { tag?: unknown } | null;
  const tag = normalizeTag(typeof body?.tag === 'string' ? body.tag : null);
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });
  const code = await inviteCode(tag);
  if (!code) return Response.json({ error: 'unavailable' }, { status: 503 });
  return Response.json({ code, url: `${SITE_URL}/bubble/invite#${code}` }, { headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = (params.get('c') ?? '').toUpperCase();
  if (!CODE.test(code)) return Response.json({ error: 'bad code' }, { status: 400 });
  const tag = await inviter(code);
  if (!tag) return Response.json({ error: 'not found' }, { status: 404 });
  const [player, name] = await Promise.all([getPlayer(tag).catch(() => null), appNames(params.get('lang'))]);
  // A player who asked to be left out is never named, even on their own link.
  const hidden = isOptedOut(tag) || !player;
  const progress = hidden ? null : rankProgress(player.rankedElo ?? null);
  const rankIndex = progress ? RANK_ELO_FLOORS.findIndex(([n]) => n === progress.rank.toUpperCase()) : -1;
  return Response.json(
    {
      tag,
      name: hidden ? null : player.name,
      iconUrl: hidden ? null : absolute(playerIconUrl(player.icon?.id)),
      rank: rankIndex >= 0 ? localRank(progress?.rank, name) : null,
      rankIcon: rankIndex >= 0 ? absolute(rankedTierIconUrl(rankIndex + 1)) : null,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3000' } },
  );
}

function absolute(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
