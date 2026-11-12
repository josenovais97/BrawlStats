import type { NextRequest } from 'next/server';

import { getBattleLog, getPlayer } from '@/lib/bs-api';
import { appNames } from '@/lib/bubble-app-l10n';
import { getBrawlerWiki } from '@/lib/brawler-wiki';
import { titleCase } from '@/lib/format';
import { okResponse } from '@/lib/route-helpers';
import { SITE_URL } from '@/lib/site';
import { brawlerPath } from '@/lib/slugs';
import { getPlayerActivity } from '@/lib/stats';
import { normalizeTag } from '@/lib/tags';

export const dynamic = 'force-dynamic';

/** Balance changes this recent count as news. */
const WINDOW_DAYS = 14;
/** How many of the player's brawlers are watched. */
const MAINS = 5;

/**
 * GET /api/bubble/patch?tag=&lang= -- balance changes to the brawlers this
 * player plays most (Bubble 1.41 patch-day alerts, 2026-11-12).
 *
 *   { mains: [brawlerId...], changes: [{ id, brawlerId, name, kind, date, url }] }
 *
 * Mains: the most games in the last 30 days where the sampler has the
 * account, else the battle log, else highest trophies. Changes: the Brawl
 * Stars Wiki's balance history for each (what the brawler pages show),
 * last two weeks; `kind` is buff, nerf or change. The app checks this hourly
 * and notifies each `id` once.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const tag = normalizeTag(q.get('tag'));
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });
  const [player, name] = await Promise.all([getPlayer(tag).catch(() => null), appNames(q.get('lang'))]);
  if (!player) return okResponse({ mains: [], changes: [] }, 600);

  const counts = new Map<number, number>();
  for (const r of (await getPlayerActivity(tag, 30).catch(() => null)) ?? []) {
    counts.set(r.brawlerId, (counts.get(r.brawlerId) ?? 0) + r.battles);
  }
  if (counts.size === 0) {
    const log = await getBattleLog(tag)
      .then((r) => r.items)
      .catch(() => []);
    for (const e of log) {
      const people = [...(e.battle.teams ?? []).flat(), ...(e.battle.players ?? [])];
      const mine = people.find((p) => normalizeTag(p.tag) === tag);
      const id = mine?.brawler?.id ?? mine?.brawlers?.[0]?.id;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  if (counts.size === 0) {
    for (const b of player.brawlers) counts.set(b.id, b.trophies);
  }
  const mains = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAINS)
    .map(([id]) => id);

  const english = new Map(player.brawlers.map((b) => [b.id, titleCase(b.name)]));
  const since = Date.now() - WINDOW_DAYS * 86_400_000;
  const changes: { id: string; brawlerId: number; name: string; kind: 'buff' | 'nerf' | 'change'; date: string; url: string }[] = [];
  for (const id of mains) {
    const en = english.get(id);
    if (!en) continue;
    const wiki = await getBrawlerWiki(en).catch(() => null);
    const seen = new Set<string>();
    for (const h of wiki?.history ?? []) {
      const at = Date.parse(`${h.date}T00:00:00Z`);
      if (!Number.isFinite(at) || at < since) continue;
      const kind = h.kind === 'Buff' ? 'buff' : h.kind === 'Nerf' ? 'nerf' : 'change';
      const key = `${id}:${h.date}:${kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      changes.push({ id: key, brawlerId: id, name: name(en.toUpperCase()), kind, date: h.date, url: `${SITE_URL}${brawlerPath(id, en)}` });
    }
  }
  return okResponse({ mains, changes }, 3600);
}
