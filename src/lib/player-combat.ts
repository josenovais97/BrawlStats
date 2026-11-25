import 'server-only';

import { NO_COMBAT, addTotals, type CombatTotals } from '@/lib/combat';
import { isOptedOut } from '@/lib/opted-out';
import { getPrisma } from '@/lib/prisma';
import { dayBefore, dayRange, todayUtc } from '@/lib/ranked-season';

/**
 * A player's kills, deaths and damage over a date range (2026-11-25), from the
 * stored days (player_ranked_combat_daily): only players the sampler follows,
 * and only days since we keep them. Days listed, like getPlayerSeasonStats.
 */
export async function getPlayerCombat(tag: string, from: string, to: string): Promise<CombatTotals | null> {
  const prisma = getPrisma();
  if (!prisma || isOptedOut(tag)) return null;
  const last = dayBefore(to) < todayUtc() ? dayBefore(to) : todayUtc();
  if (last < from) return null;
  try {
    const days = dayRange(from, last);
    const rows = await prisma.$queryRaw<Record<keyof CombatTotals, number>[]>`
      SELECT games, kills, deaths, deathless, stars, damage, healing, seconds
      FROM player_ranked_combat_daily
      WHERE day = ANY(${days}::date[]) AND player_tag = ${tag}
    `;
    if (rows.length === 0) return null;
    return rows.reduce<CombatTotals>(
      (sum, r) =>
        addTotals(sum, {
          games: Number(r.games),
          kills: Number(r.kills),
          deaths: Number(r.deaths),
          deathless: Number(r.deathless),
          stars: Number(r.stars),
          damage: Number(r.damage),
          healing: Number(r.healing),
          seconds: Number(r.seconds),
        }),
      NO_COMBAT,
    );
  } catch {
    return null;
  }
}
