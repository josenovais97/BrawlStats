import 'server-only';

import { cache } from 'react';

import { getBattleLog } from '@/lib/bs-api';
import { gamesFromLog, seasonView, todayUtc } from '@/lib/ranked-season';
import { getSeasonPair } from '@/lib/ranked-seasons';
import { getPlayerRankedSeason } from '@/lib/stats';

/** Which season: the running one, the one before it, or whichever has games. */
export type SeasonWhich = 'now' | 'last' | 'auto';

/*
 * The running season and the last one (lib/ranked-seasons getSeasonPair), not
 * the wiki's newest: that still said Season 50 six days into 51, so this tab
 * showed the season that was over (2026-11-25).
 */
export const seasonPair = cache(async () => getSeasonPair().catch(() => ({ now: null, last: null })));

const oneSeason = cache(async (tag: string, playerTag: string, which: 'now' | 'last') => {
  const pair = await seasonPair();
  const season = which === 'now' ? pair.now : pair.last;
  const from = season?.from ?? null;
  const to = season?.to ?? null;
  const data = from && to ? await getPlayerRankedSeason(tag, from, to) : null;
  const log = await getBattleLog(tag)
    .then((r) => r.items)
    .catch(() => []);
  const fromMs = from ? Date.parse(`${from}T00:00:00Z`) : 0;
  const toMs = to ? Date.parse(`${to}T00:00:00Z`) : Infinity;
  const logGames = gamesFromLog(log, playerTag).filter((g) => g.time >= fromMs && g.time < toMs);
  const view = seasonView(data?.rows ?? [], data?.games ?? [], logGames, Date.now(), data?.combat ?? []);
  const live = which === 'now' && Boolean(season);
  const daysLeft = live && to ? Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${todayUtc()}T00:00:00Z`)) / 86_400_000)) : null;
  return { which, season, from, to, live, daysLeft, data, view };
});

/**
 * The season's reads and the view built from them, once per request: the
 * Ranked tab, the Overview teaser and the share card all ask. 'auto' is the
 * running season, or the last one for an account that has not played this one.
 */
export const seasonFor = cache(async (tag: string, playerTag: string, which: SeasonWhich = 'auto') => {
  if (which !== 'auto') return oneSeason(tag, playerTag, which);
  const now = await oneSeason(tag, playerTag, 'now');
  if (now.view.games > 0) return now;
  const last = await oneSeason(tag, playerTag, 'last');
  return last.view.games > 0 ? last : now;
});
