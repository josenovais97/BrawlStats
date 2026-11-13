import { unstable_cache } from 'next/cache';
import type { NextRequest } from 'next/server';

import { rankedTierIconUrl } from '@/lib/brawlapi';
import { getClub, getPlayer } from '@/lib/bs-api';
import { titleCaseLabel } from '@/lib/format';
import { isOptedOut } from '@/lib/opted-out';
import { okResponse } from '@/lib/route-helpers';
import { normalizeTag } from '@/lib/tags';

export const dynamic = 'force-dynamic';

interface Member {
  key: string;
  name: string;
  elo: number | null;
  rank: string | null;
  rankIcon: string | null;
}

/**
 * One club's members by Ranked elo, read from each member's profile.
 * Cached six hours per club: up to 30 profile reads is not something every
 * panel open should cost, and the order of a club changes slowly.
 * `key` is an opaque per-member id (never the tag), so the panel can say
 * which row is the reader's without the response listing tags.
 */
const clubLadder = unstable_cache(
  async (clubTag: string): Promise<{ name: string; members: (Member & { tag: string })[] } | null> => {
    const club = await getClub(clubTag).catch(() => null);
    if (!club) return null;
    const members = club.members.filter((m) => !isOptedOut(normalizeTag(m.tag) ?? ''));
    const out: (Member & { tag: string })[] = [];
    for (let i = 0; i < members.length; i += 5) {
      const batch = await Promise.all(
        members.slice(i, i + 5).map(async (m) => {
          const tag = normalizeTag(m.tag) ?? '';
          const p = await getPlayer(tag).catch(() => null);
          return {
            tag,
            key: String(i) + ':' + m.name.length + ':' + (p?.rankedElo ?? 0),
            name: m.name,
            elo: p?.rankedElo ?? null,
            rank: p?.rankedRankName ? titleCaseLabel(p.rankedRankName) : null,
            rankIcon: rankedTierIconUrl(p?.rankedRank ?? null),
          };
        }),
      );
      out.push(...batch);
    }
    out.sort((a, b) => (b.elo ?? -1) - (a.elo ?? -1));
    out.forEach((m, i) => (m.key = `m${i}`));
    return { name: club.name, members: out };
  },
  ['bubble-club-ladder-v1'],
  { revalidate: 21_600 },
);

/**
 * GET /api/bubble/club?tag= -- the player's club by Ranked elo (2026-11-13),
 * for the panel's player card. Quiet by design: no notifications, read only
 * when the card is opened. `you` is the reader's own row key.
 */
export async function GET(request: NextRequest) {
  const tag = normalizeTag(request.nextUrl.searchParams.get('tag'));
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });
  const player = await getPlayer(tag).catch(() => null);
  const clubTag = normalizeTag(player?.club?.tag ?? null);
  if (!clubTag) return okResponse({ club: null }, 600);
  const ladder = await clubLadder(clubTag).catch(() => null);
  if (!ladder) return okResponse({ club: null }, 300);
  const you = ladder.members.find((m) => m.tag === tag)?.key ?? null;
  return okResponse(
    { club: { name: ladder.name, members: ladder.members.map((m) => ({ key: m.key, name: m.name, elo: m.elo, rank: m.rank, rankIcon: m.rankIcon })), you } },
    600,
  );
}
