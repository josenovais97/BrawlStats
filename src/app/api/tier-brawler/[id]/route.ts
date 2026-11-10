import type { NextRequest } from 'next/server';

import { brawlerIconUrl, getGameModeMap } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getOfficialBrawlers } from '@/lib/bs-api';
import { fankitBody, gadgetArt, gearArt, starPowerArt } from '@/lib/fankit';
import { getActiveMaps, type GameMap } from '@/lib/game-maps';
import { isIntlLocale, type Locale } from '@/lib/i18n';
import { gameWords } from '@/lib/i18n-game';
import { getBrawlerBuild, getBrawlerPairings, getBrawlerSplits, getBrawlerTrend, mapNameKey, type BrawlerPairing, type BrawlerSplit } from '@/lib/stats';
import type { TierBrawlerDetail, TierBrawlerRef, TierBrawlerSlice } from '@/lib/tier-brawler';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';
import type { BSBrawler } from '@/types/brawlstars';

/**
 * One brawler's panel on the tier list (2026-11-10): trend, modes, maps,
 * matchups and build, from the same cached reads the brawler page uses, so a
 * tap costs a cache hit. Read one after another to keep to one connection.
 * Under /api/, which robots.txt and the crawl policy already keep crawlers
 * out of.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const brawlerId = Number((await params).id);
  if (!Number.isInteger(brawlerId) || brawlerId < 16_000_000 || brawlerId > 16_999_999) {
    return Response.json({ error: 'bad id' }, { status: 400 });
  }
  const lang = request.nextUrl.searchParams.get('lang');
  // The Ranked list sends its modes, so Showdown and the like stay out.
  const only = new Set(
    (request.nextUrl.searchParams.get('modes') ?? '')
      .split(',')
      .filter((m) => /^[A-Za-z0-9]{2,30}$/.test(m)),
  );
  const keep = (s: BrawlerSplit) => only.size === 0 || only.has(s.mode);
  const locale: Locale = isIntlLocale(lang) ? lang : 'en';

  const art = await getBrawlerArtMap().catch(() => new Map<number, BABrawler>());
  const brawler = art.get(brawlerId);
  if (!brawler) return Response.json({ error: 'unknown brawler' }, { status: 404 });

  const trend = await getBrawlerTrend(brawlerId, 30).catch(() => []);
  const splits = await getBrawlerSplits(brawlerId, 14).catch(() => ({ modes: [] as BrawlerSplit[], maps: [] as BrawlerSplit[] }));
  const pairings = await getBrawlerPairings(brawlerId, 21, 5).catch(() => null);
  const build = await getBrawlerBuild(brawlerId).catch(() => null);
  const [modes, words, maps, official] = await Promise.all([
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
    gameWords(locale),
    getActiveMaps().catch(() => [] as GameMap[]),
    getOfficialBrawlers()
      .then((r) => r.items as BSBrawler[])
      .catch(() => [] as BSBrawler[]),
  ]);

  const mapByKey = new Map(maps.map((m) => [mapNameKey(m.map.name), m]));
  const modeIcon = (mode: string) => modes.get(mode.toLowerCase())?.imageUrl ?? null;
  const slice = (s: BrawlerSplit): TierBrawlerSlice => ({
    name: s.mapName ? words.map(s.mapName) : words.mode(s.mode),
    mode: s.mode,
    modeName: words.mode(s.mode),
    modeIcon: modeIcon(s.mode),
    image: s.mapName ? (mapByKey.get(mapNameKey(s.mapName))?.map.imageUrl ?? null) : null,
    winRate: s.winRate,
    score: s.score,
    games: s.decidedSampleSize,
  });
  const ref = (p: BrawlerPairing): TierBrawlerRef => ({
    id: p.brawlerId,
    name: art.get(p.brawlerId)?.name ?? `#${p.brawlerId}`,
    icon: art.get(p.brawlerId)?.imageUrl ?? brawlerIconUrl(p.brawlerId),
    winRate: p.winRate,
    edge: p.edge,
    games: p.decidedSampleSize,
  });
  // Maps need a real sample: a map with 74 games at 88% is noise, not a pick.
  const kept = splits.maps.filter(keep);
  const solid = kept.filter((m) => m.decidedSampleSize >= 300);
  const byScore = (solid.length >= 5 ? solid : kept.filter((m) => m.decidedSampleSize >= 100)).sort((a, b) => b.score - a.score);
  const live = official.find((b) => b.id === brawlerId);
  const nameOf = (list: { id: number; name: string }[] | undefined, id: number) => list?.find((x) => x.id === id)?.name ?? '';
  const top = <T extends { share: number }>(list: T[] | undefined) => [...(list ?? [])].sort((a, b) => b.share - a.share);
  const sp = top(build?.starPowers)[0];
  const gd = top(build?.gadgets)[0];

  const detail: TierBrawlerDetail = {
    id: brawlerId,
    name: brawler.name,
    art: fankitBody(brawlerId),
    icon: brawler.imageUrl ?? brawlerIconUrl(brawlerId),
    className: brawler.class?.name ?? null,
    trend: trend.map((p) => ({ date: p.date, winRate: p.normalizedWinRate, pickRate: p.usageRate })),
    modes: splits.modes.filter(keep).sort((a, b) => b.score - a.score).slice(0, 6).map(slice),
    bestMaps: byScore.slice(0, 4).map(slice),
    worstMaps: byScore.length > 6 ? byScore.slice(-3).reverse().map(slice) : [],
    strong: (pairings?.strongAgainst ?? []).map(ref),
    weak: (pairings?.weakAgainst ?? []).map(ref),
    mates: (pairings?.bestWith ?? []).map(ref),
    build: {
      starPower: sp ? { name: nameOf(brawler.starPowers, sp.itemId), icon: starPowerArt(sp.itemId), share: sp.share } : null,
      gadget: gd ? { name: nameOf(brawler.gadgets, gd.itemId), icon: gadgetArt(gd.itemId), share: gd.share } : null,
      gears: top(build?.gears)
        .slice(0, 2)
        .map((g) => {
          const name = nameOf(live?.gears, g.itemId);
          return { name, icon: gearArt(g.itemId, name, brawler.name), share: g.share };
        }),
    },
  };

  return Response.json(detail, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=7200' },
  });
}
