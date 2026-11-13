import type { NextRequest } from 'next/server';

import { brawlerIconUrl, getGameModeMap, getMapMap } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getEventRotation, getPlayer } from '@/lib/bs-api';
import { partitionRotation } from '@/lib/format';
import { okResponse } from '@/lib/route-helpers';
import { getLadderMapForm, type MapForm } from '@/lib/stats';
import { normalizeTag } from '@/lib/tags';
import type { BABrawler, BAGameMode, BAMap } from '@/types/brawlapi';
import type { BSPlayerBrawler } from '@/types/brawlstars';

export const dynamic = 'force-dynamic';

/** Below this power a brawler is not one to push with. */
const USABLE_POWER = 9;

/**
 * GET /api/bubble/push?tag= -- the panel's Trophies tab (2026-11-13).
 *
 *   { events: [{ mode, map, endsAt, image, modeIcon, best: [Pick], yours: [Pick] }],
 *     prestige: [{ brawlerId, name, icon, trophies, toNext }] }
 *
 * Events: the live trophy rotation. `best` is each map's top three by the
 * ladder's map form (getLadderMapForm, adjusted to the map's average);
 * `yours` the same list filtered to this account's brawlers at power 9+,
 * with their trophies. `prestige`: the account's brawlers closest to their
 * next 1,000-trophy prestige. Game names are English; the panel localizes.
 */
export async function GET(request: NextRequest) {
  const tag = normalizeTag(request.nextUrl.searchParams.get('tag'));
  const [rotation, form, mapMeta, modeMeta, art, player] = await Promise.all([
    getEventRotation(300).catch(() => []),
    getLadderMapForm().catch(() => new Map<string, MapForm[]>()),
    getMapMap().catch(() => new Map<number, BAMap>()),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
    tag ? getPlayer(tag).catch(() => null) : Promise.resolve(null),
  ]);
  const owned = new Map<number, BSPlayerBrawler>((player?.brawlers ?? []).map((b) => [b.id, b]));
  const icon = (id: number) => art.get(id)?.imageUrl ?? brawlerIconUrl(id);
  const nameOf = (id: number) => art.get(id)?.name ?? owned.get(id)?.name ?? '';

  const { active } = partitionRotation(rotation);
  const events = active
    .filter((slot) => slot.event?.map)
    .sort((a, b) => a.slotId - b.slotId)
    .map((slot) => {
      const list = form.get(slot.event.map!) ?? [];
      const pick = (f: MapForm) => ({ brawlerId: f.brawlerId, name: nameOf(f.brawlerId), icon: icon(f.brawlerId), rate: f.adjusted, trophies: owned.get(f.brawlerId)?.trophies ?? null });
      return {
        mode: slot.event.mode,
        map: slot.event.map,
        endsAt: slot.endTime,
        image: mapMeta.get(slot.event.id)?.imageUrl ?? null,
        modeIcon: modeMeta.get((slot.event.mode ?? '').toLowerCase())?.imageUrl ?? null,
        best: list.slice(0, 3).map(pick),
        yours: player ? list.filter((f) => (owned.get(f.brawlerId)?.power ?? 0) >= USABLE_POWER && f.adjusted > 0.5).slice(0, 3).map(pick) : [],
      };
    })
    .filter((e) => e.best.length > 0);

  const prestige = (player?.brawlers ?? [])
    .filter((b) => b.trophies >= 300)
    .map((b) => ({ brawlerId: b.id, name: nameOf(b.id), icon: icon(b.id), trophies: b.trophies, toNext: 1000 - (b.trophies % 1000) }))
    .sort((a, b) => a.toNext - b.toNext)
    .slice(0, 5);

  return okResponse({ events, prestige, hasTag: Boolean(player) }, 120);
}
