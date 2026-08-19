import type { Metadata } from 'next';

import { BrawlerBrowser } from '@/components/brawlers/brawler-browser';
import { ErrorState } from '@/components/ui/error-state';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';

export const metadata: Metadata = {
  alternates: { canonical: '/brawlers' },
  title: 'Brawl Stars brawlers',
  description:
    'Every Brawl Stars brawler with class, rarity, star powers and gadgets.',
};

/** Static metadata — rebuild daily rather than on every request. */
export const revalidate = 86400;

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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Brawlers</h1>
        {/* The count is the playable roster, not the row count: the artwork
            source still lists withdrawn brawlers, and they are shown here with
            a Legacy badge rather than counted as current. */}
        <p className="mt-2 text-muted">
          {`All ${catalog.current.length} current brawlers, with class, rarity, star powers and gadgets${
            catalog.legacy.length > 0
              ? `, plus ${catalog.legacy.length} no longer playable.`
              : '.'
          }`}
        </p>
      </header>

      <BrawlerBrowser
        brawlers={catalog.all.map((b) => ({
          id: b.id,
          name: b.name,
          imageUrl: b.meta?.imageUrl ?? brawlerIconUrl(b.id),
          // Null rather than "Unknown": the artwork source reports that
          // literal string for every brawler released since Meeple, and a chip
          // reading "Unknown" on a fifth of the roster is worse than no chip.
          className: b.className,
          rarityName: b.rarityName,
          rarityColor: b.rarityColor ?? '#8b95b8',
          status: b.status,
          starPowers: b.meta?.starPowers.length ?? 0,
          gadgets: b.meta?.gadgets.length ?? 0,
        }))}
      />
    </div>
  );
}
