import type { Metadata } from 'next';

import { BrawlerBrowser } from '@/components/brawlers/brawler-browser';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeading } from '@/components/ui/section-heading';
import { PageNotes } from '@/components/ui/page-notes';
import { formatNumber, formatPercent, titleCaseLabel } from '@/lib/format';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { currentMonth } from '@/lib/site';
import { getUpcomingBrawlers, type UpcomingBrawler } from '@/lib/announced';
import { BrawlersPulse } from '@/components/brawlers/brawlers-pulse';
import { getBanRates } from '@/lib/ranked-numbers-data';
import { getMetaIndex, getMetaMovers, type ScoredBrawler } from '@/lib/stats';
import type { MetaMover } from '@/types/stats';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';

/*
 * A function, not a `metadata` object, because of the month in the title.
 *
 * A static `metadata` export is evaluated once when the module loads, so the
 * month would freeze at server start and only move on a restart. Generated per
 * render, it refreshes whenever ISR revalidates the page — and the monthly
 * rebuild is then a backstop rather than the only thing keeping it honest.
 */
export function generateMetadata(): Metadata {
  const t = getT(requestLocale());
  return {
    alternates: { canonical: '/brawlers' },
    title: t('All Brawl Stars brawlers ranked ({v})', { v: currentMonth() }),
    description: t('Every Brawl Stars brawler with its Ranked tier, class, rarity, star powers and gadgets, {v}. Sorted strongest first from sampled battles.', { v: currentMonth() }),
  };
}

/*
 * Hourly rather than daily, since the tier on each card comes from a sampler
 * that runs every three hours. The artwork half of the page would happily sit
 * for a day; the half that says how strong a brawler is would be a day stale,
 * and would disagree with the tier list it links to.
 */
export const revalidate = 3600;

export default async function BrawlersPage() {
  const t = getT(requestLocale());
  let catalog;
  try {
    catalog = await getBrawlerCatalog();
    if (catalog.all.length === 0) throw new Error('empty catalogue');
  } catch {
    return (
      <ErrorState
        code="upstreamDown"
        title={t('Brawler data unavailable')}
        detail={t('The brawler metadata source (brawlapi.com) is not responding. Try again shortly.')}
      />
    );
  }

  /*
   * The same ranking the tier list renders, joined onto the catalogue. Falls
   * back to an empty index rather than an error: a brawler index without tiers
   * is still a brawler index, and the artwork source and the database fail
   * independently of each other.
   */
  const meta: Map<number, ScoredBrawler> = await getMetaIndex('ranked', 7).catch(() => new Map());
  const movers = await getMetaMovers(7).catch(() => [] as MetaMover[]);
  const moverBy = new Map(movers.map((m) => [m.brawlerId, m]));
  const banRates = await getBanRates('all').catch(() => null);
  const images = new Map(catalog.all.map((b) => [b.id, { name: b.name, image: b.imageUrl || null }]));

  /*
   * Revealed but not shipped. Fetched here so the index can list them: this is
   * the page people use to look a brawler up, and finding nothing for a name
   * that is all over the game's own announcements is the gap their pages were
   * built to close.
   */
  const upcoming = await getUpcomingBrawlers(
    catalog.all.map((b) => b.name),
  ).catch(() => [] as UpcomingBrawler[]);

  /*
   * The week in words, under the grid (2026-11-23, AdSense "low value
   * content"): who leads, who is picked most, who moved, and how the tiers
   * are made. Each sentence is dropped when its numbers are missing.
   */
  const rated = [...meta.values()].filter((b) => b.tier && b.normalizedWinRate !== null && b.metaScore !== null);
  const leader = [...rated].sort((a, b) => (b.metaScore as number) - (a.metaScore as number))[0];
  const picked = [...rated].sort((a, b) => (b.usageRate ?? 0) - (a.usageRate ?? 0))[0];
  const climbs = movers.filter((m) => m.metaScoreDelta > 0 && m.tierNow !== m.tierBefore).sort((a, b) => b.metaScoreDelta - a.metaScoreDelta);
  const drops = movers.filter((m) => m.metaScoreDelta < 0 && m.tierNow !== m.tierBefore).sort((a, b) => a.metaScoreDelta - b.metaScoreDelta);
  const notes = [
    leader && picked
      ? t('{top} leads Ranked this week with an adjusted win rate of {rate} over {games} decided games, and {picked} is picked most, in {share} of all picks.', {
          top: titleCaseLabel(leader.brawlerName),
          rate: formatPercent(leader.normalizedWinRate),
          games: formatNumber(leader.decidedSampleSize),
          picked: titleCaseLabel(picked.brawlerName),
          share: formatPercent(picked.usageRate),
        })
      : '',
    climbs[0] && drops[0]
      ? t('Since last week {up} has climbed the furthest, from {from} to {to} tier, while {down} dropped from {dfrom} to {dto}.', {
          up: titleCaseLabel(climbs[0].brawlerName),
          from: climbs[0].tierBefore,
          to: climbs[0].tierNow,
          down: titleCaseLabel(drops[0].brawlerName),
          dfrom: drops[0].tierBefore,
          dto: drops[0].tierNow,
        })
      : '',
    t('Every tier comes from real Ranked matches we sample ourselves every few hours, all six brawlers of each battle, not from votes or opinion. Win rates are adjusted against the average of the same sample, so a tier reflects the brawler rather than who was playing it, and a brawler needs enough decided games before it gets a tier at all.'),
    t('Open any brawler for its best maps and modes, its counters, the teammates it wins with and the gears its players buy.'),
  ];

  return (
    <div className="space-y-6">
      {/* The count is the playable roster, not the row count: the artwork
          source still lists withdrawn brawlers, and revealed-but-unreleased
          ones are listed too. Both carry a badge rather than being counted as
          current. */}
      <PageHeading
        title={t('Brawlers')}
        subtitle={t('All {length} current brawlers with their Ranked tier, sortable by how strong they are right now{v}', { length: catalog.current.length, v: catalog.legacy.length > 0
            ? `. ${t('Plus {n} no longer playable.', { n: catalog.legacy.length })}`
            : '.' })}
      />

      {/* The week at a glance before the grid (2026-11-11). */}
      <BrawlersPulse meta={meta} movers={movers} images={images} />

      <BrawlerBrowser
        brawlers={[
          ...catalog.all.map((b) => ({
            id: b.id,
            name: b.name,
            imageUrl: b.imageUrl,
            // Null rather than "Unknown": the artwork source reports that
            // literal string for every brawler released since Meeple, and a chip
            // reading "Unknown" on a fifth of the roster is worse than no chip.
            className: b.className,
            rarityName: b.rarityName,
            rarityColor: b.rarityColor ?? '#8b95b8',
            status: b.status,
            tier: meta.get(b.id)?.tier ?? null,
            metaScore: meta.get(b.id)?.metaScore ?? null,
            winRate: meta.get(b.id)?.normalizedWinRate ?? null,
            pickRate: meta.get(b.id)?.usageRate ?? null,
            // Only brawlers in this week's Ranked list: a withdrawn one has no bans to show.
            banRate: banRates && meta.has(b.id) ? banRates.get(b.id) ?? 0 : null,
            delta: moverBy.get(b.id)?.metaScoreDelta ?? null,
            tierBefore: moverBy.get(b.id)?.tierBefore ?? null,
          })),
          /*
           * Revealed but not shipped. Listed because searching the name here
           * and finding nothing is the failure their pages exist to prevent —
           * this index is where people look for a brawler.
           *
           * Negative ids: these are not in the catalogue and have no real id,
           * and a negative one cannot collide with a brawler that later ships
           * under the same name. Links are built from the name regardless.
           */
          ...upcoming.map((b, i) => ({
            id: -(i + 1),
            name: b.name,
            imageUrl: b.portraitUrl ?? '',
            className: b.className,
            rarityName: b.rarityName,
            rarityColor: '#8b7cf6',
            status: 'upcoming' as const,
            tier: null,
            metaScore: null,
          })),
        ]}
      />

      <PageNotes title={t('About these rankings')} paragraphs={notes} />
    </div>
  );
}
