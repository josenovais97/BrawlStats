import type { NextRequest } from 'next/server';

import { brawlerIconUrl, getGameModeMap, modeLabel } from '@/lib/brawlapi';
import { brawlerArt } from '@/lib/brawler-art';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getPlayer } from '@/lib/bs-api';
import { appNames } from '@/lib/bubble-app-l10n';
import { NO_COMBAT, MIN_COMBAT_GAMES, addGame, combatRates, expectedRates, type CombatRates, type CombatTotals } from '@/lib/combat';
import { isOptedOut } from '@/lib/opted-out';
import { seasonFor, seasonPair } from '@/lib/player-season-data';
import { bracketForRankName } from '@/lib/rank-brackets';
import { isRankKey, type RankNumbers } from '@/lib/ranked-numbers';
import { getRankNumbers } from '@/lib/ranked-numbers-data';
import { okResponse } from '@/lib/route-helpers';
import { SITE_URL } from '@/lib/site';
import { getPlayerSeasonStats } from '@/lib/stats';
import { normalizeTag } from '@/lib/tags';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';

/**
 * One Ranked season of one player for the Bubble app's Season tab (1.45): the
 * running one or the last (`which=last`). Games and wins, the numbers of the
 * games that carry them against what others at the player's rank do with the
 * same brawlers, mode by mode, the brawlers, and what stands out (`coach`).
 * The same reading as the profile's Ranked tab (lib/player-season-data); the
 * app adds what it counted itself. Nothing is sent but the tag.
 */

export const dynamic = 'force-dynamic';

const absolute = (url: string | null | undefined) => (!url ? null : url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`);
const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places;
const rates = (c: CombatRates | null) =>
  c
    ? { kd: round(c.kd), kills: round(c.kills), deaths: round(c.deaths), damage: Math.round(c.damage), healing: Math.round(c.healing), star: round(c.star, 4), deathless: round(c.deathless, 4) }
    : null;

/** Fewer games than this in a mode and it is not compared. */
const MIN_MODE_GAMES = 4;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const tag = normalizeTag(q.get('tag'));
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });
  if (isOptedOut(tag)) return Response.json({ error: 'not found' }, { status: 404 });
  const which = q.get('which') === 'last' ? 'last' : 'now';

  const [player, name, art, modeMeta, pair] = await Promise.all([
    getPlayer(tag).catch(() => null),
    appNames(q.get('lang')),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
    seasonPair(),
  ]);
  if (!player) return Response.json({ error: 'not found' }, { status: 404 });

  const { season, from, to, daysLeft, view } = await seasonFor(tag, player.tag, which);
  const totals = view.combat.totals;
  const mine = totals.games >= MIN_COMBAT_GAMES ? combatRates(totals) : null;

  // Others: the player's own rank, or Mythic and up where it has too few games.
  const bracket = bracketForRankName(player.rankedRankName) ?? bracketForRankName(player.highestSeasonRankedRankName);
  const own: RankNumbers | null = bracket && isRankKey(bracket.slug) ? await getRankNumbers(bracket.slug).catch(() => null) : null;
  const ownRates = own ? expectedRates(view.combat.byBrawler, own.stats.all ?? []) : null;
  const wide = ownRates ? null : await getRankNumbers('mythic-plus').catch(() => null);
  const ref = ownRates ? own : wide;
  const others = ownRates ?? (wide ? expectedRates(view.combat.byBrawler, wide.stats.all ?? []) : null);

  // Mode by mode, over the single games that carry numbers.
  const byMode = new Map<string, { games: number; wins: number; totals: CombatTotals; brawlers: Map<number, CombatTotals> }>();
  for (const g of view.recent) {
    const m = byMode.get(g.mode) ?? { games: 0, wins: 0, totals: NO_COMBAT, brawlers: new Map() };
    byMode.set(g.mode, m);
    m.games += 1;
    if (g.win) m.wins += 1;
    if (!g.combat) continue;
    m.totals = addGame(m.totals, g.combat);
    m.brawlers.set(g.brawlerId, addGame(m.brawlers.get(g.brawlerId) ?? NO_COMBAT, g.combat));
  }
  const modes = [...byMode.entries()]
    .map(([key, m]) => {
      const c = m.totals.games >= MIN_MODE_GAMES ? combatRates(m.totals) : null;
      const o = c && ref ? expectedRates(m.brawlers, ref.stats[key] ?? []) : null;
      return {
        key,
        label: name(modeLabel(modeMeta, key)),
        icon: absolute(modeMeta.get(key.toLowerCase())?.imageUrl ?? null),
        games: m.games,
        wins: m.wins,
        fought: m.totals.games,
        mine: rates(c),
        others: rates(o),
      };
    })
    .sort((a, b) => b.games - a.games);

  /*
   * What stands out, worst and best, only where both numbers are there and
   * they are at least a quarter apart: deaths and K/D against others in a
   * mode. Facts for the app to word, never a guess at why.
   */
  const gaps = modes
    .filter((m) => m.mine && m.others && m.fought >= 6)
    .flatMap((m) => {
      const a = m.mine!;
      const b = m.others!;
      return [
        { kind: 'deaths', mode: m.key, label: m.label, icon: m.icon, mine: a.deaths, others: b.deaths, gap: (a.deaths - b.deaths) / Math.max(0.5, b.deaths), games: m.fought },
        { kind: 'kd', mode: m.key, label: m.label, icon: m.icon, mine: a.kd, others: b.kd, gap: (a.kd - b.kd) / Math.max(0.3, b.kd), games: m.fought },
      ];
    });
  const worst = gaps.filter((g) => g.kind === 'deaths' && g.gap >= 0.25).sort((a, b) => b.gap - a.gap)[0] ?? null;
  const best = gaps.filter((g) => g.kind === 'kd' && g.gap >= 0.25).sort((a, b) => b.gap - a.gap)[0] ?? null;
  const coach = [worst, best].filter((g): g is NonNullable<typeof g> => g !== null).map((g) => ({ ...g, gap: round(g.gap) }));

  // How often each of the player's brawlers is banned at their rank.
  const bans = ref && ref.battles >= 500 ? new Map(ref.bans) : null;
  const brawlers = [...view.brawlers]
    .sort((a, b) => b.games - a.games)
    .slice(0, 40)
    .map((b) => {
      const c = view.combat.byBrawler.get(b.brawlerId);
      const r = c && c.games >= 3 ? combatRates(c) : null;
      const meta = art.get(b.brawlerId);
      return {
        id: b.brawlerId,
        name: meta ? name(meta.name) : String(b.brawlerId),
        icon: absolute(meta?.imageUrl ?? brawlerIconUrl(b.brawlerId)),
        color: meta?.rarity?.color ?? null,
        games: b.games,
        wins: b.wins,
        kd: r ? round(r.kd) : null,
        ban: bans ? round(bans.get(b.brawlerId) ?? 0, 4) : null,
      };
    });

  // The most played brawler as this account wears it, behind the page's big card.
  const heroId = brawlers[0]?.id ?? null;
  const hero = heroId === null ? null : await brawlerArt(player.brawlers.filter((b) => b.id === heroId), art).then((m) => m.get(heroId) ?? null).catch(() => null);

  const lastSeason = pair.last;
  const lastStats = which === 'now' && lastSeason ? await getPlayerSeasonStats(tag, lastSeason.from, lastSeason.to) : null;

  return okResponse(
    {
      tag,
      which,
      season: season ? { number: season.number, from, to, daysLeft } : null,
      // The other season, for the switch: shown only when there is one to show.
      last: lastSeason ? { number: lastSeason.number, games: lastStats?.games ?? null, wins: lastStats?.wins ?? null } : null,
      games: view.games,
      wins: view.wins,
      // Only when every game is held one by one, never half a season's run.
      streak: view.detail.games >= view.games * 0.98 ? view.detail.streaks.longestWin : null,
      fought: totals.games,
      mine: rates(mine),
      others: rates(others),
      othersAt: ref?.rank ?? null,
      modes,
      coach,
      brawlers,
      hero: absolute(hero),
    },
    600,
  );
}
