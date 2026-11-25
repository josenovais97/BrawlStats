import 'server-only';

import { unstable_cache } from 'next/cache';
import { cache } from 'react';

import { weekTrend } from '@/lib/meta-changes';
import { getPrisma } from '@/lib/prisma';
import { windowStartUtc } from '@/lib/stats';

/**
 * Which brawlers won clearly more or less these 7 days than the 7 before, in
 * one rank or all of them (the rule is lib/meta-changes weekTrend), read from
 * whole Ranked lineups. For the tier list pictures (2026-11-25).
 *
 * In a file of its own: `cachedRead` keys on compiled text, so adding this to
 * lib/stats would start every read on the site cold on its deploy.
 */
export async function computeWeekTrend(bracket?: number): Promise<Record<number, 1 | -1>> {
  const prisma = getPrisma();
  if (!prisma) return {};
  const [from, mid] = [windowStartUtc(14), windowStartUtc(7)];
  const read = async (day: { gte: Date; lt?: Date }) => {
    const rows = await prisma.rankedLineupDaily.groupBy({
      by: ['brawlerId'],
      where: { day, ...(bracket ? { rankBracket: bracket } : {}) },
      _sum: { wins: true, losses: true },
    });
    return rows.map((r) => ({ brawlerId: r.brawlerId, wins: r._sum.wins ?? 0, games: (r._sum.wins ?? 0) + (r._sum.losses ?? 0) }));
  };
  const [now, before] = await Promise.all([read({ gte: mid }), read({ gte: from, lt: mid })]);
  return weekTrend(now, before);
}

/* Two hours, like the reads of the lists it sits on (READ_CACHE_SECONDS). */
const cachedWeekTrend = unstable_cache(async (bracket: number) => computeWeekTrend(bracket || undefined), ['week-trend'], { revalidate: 7200 });

/** `computeWeekTrend`, cached for pages. Scripts call that one directly. */
export const getWeekTrend = cache(async (bracket?: number): Promise<Record<number, 1 | -1>> => cachedWeekTrend(bracket ?? 0));
