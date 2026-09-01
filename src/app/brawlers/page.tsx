import type { Metadata } from 'next';

import { BrawlerBrowser } from '@/components/brawlers/brawler-browser';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeading } from '@/components/ui/section-heading';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { currentMonth } from '@/lib/site';
import { getUpcomingBrawlers, type UpcomingBrawler } from '@/lib/announced';
import { getMetaIndex } from '@/lib/stats';

/*
 * A function, not a `metadata` object, because of the month in the title.
 *
 * A static `metadata` export is evaluated once when the module loads, so the
 * month would freeze at server start and only move on a restart. Generated per
 * render, it refreshes whenever ISR revalidates the page — and the monthly
 * rebuild is then a backstop rather than the only thing keeping it honest.
 */
export function generateMetadata(): Metadata {
  return {
    alternates: { canonical: '/brawlers' },
    title: `All Brawl Stars brawlers ranked (${currentMonth()})`,
    description: `Every Brawl Stars brawler with its Ranked tier, class, rarity, star powers and gadgets, ${currentMonth()}. Sorted strongest first from sampled battles.`,
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
  let catalog;
  try {
    catalog = await getBrawlerCatalog();
    if (catalog.all.length === 0) throw new Error('empty catalogue');
  } catch {
    return (
      <ErrorState
        code="upstreamDown"
        title="Brawler data unavailable"
        detail="The brawler metadata source (brawlapi.com) is not responding. Try again shortly."
      />
    );
  }

  /*
   * The same ranking the tier list renders, joined onto the catalogue. Falls
   * back to an empty index rather than an error: a brawler index without tiers
   * is still a brawler index, and the artwork source and the database fail
   * independently of each other.
   */
  const meta = await getMetaIndex('ranked', 7).catch(() => new Map());

  /*
   * Revealed but not shipped. Fetched here so the index can list them: this is
   * the page people use to look a brawler up, and finding nothing for a name
   * that is all over the game's own announcements is the gap their pages were
   * built to close.
   */
  const upcoming = await getUpcomingBrawlers(
    catalog.all.map((b) => b.name),
  ).catch(() => [] as UpcomingBrawler[]);

  return (
    <div className="space-y-6">
      {/* The count is the playable roster, not the row count: the artwork
          source still lists withdrawn brawlers, and revealed-but-unreleased
          ones are listed too. Both carry a badge rather than being counted as
          current. */}
      <PageHeading
        title="Brawlers"
        subtitle={`All ${catalog.current.length} current brawlers with their Ranked tier, sortable by how strong they are right now${
          catalog.legacy.length > 0
            ? `. Plus ${catalog.legacy.length} no longer playable.`
            : '.'
        }`}
      />

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
    </div>
  );
}
