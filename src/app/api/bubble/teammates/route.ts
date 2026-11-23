import type { NextRequest } from 'next/server';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getBattleLog } from '@/lib/bs-api';
import { isOptedOut } from '@/lib/opted-out';
import { okResponse } from '@/lib/route-helpers';
import { SITE_URL } from '@/lib/site';
import { normalizeTag } from '@/lib/tags';

/**
 * People you queue with (Bubble 1.43, 2026-11-23).
 *
 * GET ?tag=<tag>&skip=<tag,tag> → the players who were on your team at least
 * twice in your last 25 battles, most games first, each with the brawler they
 * played most with you. A random teammate shows up once; a duo partner shows
 * up again and again, so two games together is the line. Squad's empty state
 * offers them as one-tap friends, which fills the list without an invite.
 *
 * Names and tags only, as the battle log already shows them to anyone; opted-out
 * players are never returned. `skip` drops tags already in the friends list.
 */
export const dynamic = 'force-dynamic';

const MAX = 5;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const tag = normalizeTag(q.get('tag'));
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });
  const skip = new Set((q.get('skip') ?? '').split(',').map((t) => normalizeTag(t)).filter(Boolean));
  const [log, art] = await Promise.all([
    getBattleLog(tag)
      .then((r) => r.items ?? [])
      .catch(() => null),
    getBrawlerArtMap().catch(() => new Map()),
  ]);
  if (!log) return okResponse({ players: [], unavailable: true }, 60);

  const seen = new Map<string, { name: string; games: number; wins: number; brawlers: Map<number, number> }>();
  for (const entry of log) {
    const teams = entry.battle.teams;
    if (!teams || teams.length < 2) continue;
    const mine = teams.find((team) => team.some((p) => normalizeTag(p.tag) === tag));
    if (!mine) continue;
    const won = entry.battle.result === 'victory';
    for (const p of mine) {
      const other = normalizeTag(p.tag);
      if (!other || other === tag || skip.has(other) || isOptedOut(other)) continue;
      const row = seen.get(other) ?? { name: p.name ?? `#${other}`, games: 0, wins: 0, brawlers: new Map<number, number>() };
      row.games += 1;
      if (won) row.wins += 1;
      const id = p.brawler?.id;
      if (id) row.brawlers.set(id, (row.brawlers.get(id) ?? 0) + 1);
      seen.set(other, row);
    }
  }

  const players = [...seen.entries()]
    .filter(([, r]) => r.games >= 2)
    .sort((a, b) => b[1].games - a[1].games || b[1].wins - a[1].wins)
    .slice(0, MAX)
    .map(([other, r]) => {
      const top = [...r.brawlers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const icon = top ? (art.get(top)?.imageUrl ?? brawlerIconUrl(top)) : null;
      return { tag: other, name: r.name, games: r.games, wins: r.wins, icon: icon ? absolute(icon) : null };
    });
  return okResponse({ players }, 300);
}

function absolute(url: string): string {
  return url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
