import type { Metadata } from 'next';

import { BrawlerBrowser } from '@/components/brawlers/brawler-browser';
import { ErrorState } from '@/components/ui/error-state';
import { getBrawlers } from '@/lib/brawlapi';

export const metadata: Metadata = {
  alternates: { canonical: '/brawlers' },
  title: 'Brawler database',
  description:
    'Every Brawl Stars brawler with class, rarity, star powers and gadgets.',
};

/** Static metadata — rebuild daily rather than on every request. */
export const revalidate = 86400;

export default async function BrawlersPage() {
  let brawlers;
  try {
    brawlers = await getBrawlers();
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
        <p className="mt-2 text-muted">
          All {brawlers.length} brawlers, with class, rarity, star powers and gadgets.
        </p>
      </header>

      <BrawlerBrowser
        brawlers={brawlers.map((b) => ({
          id: b.id,
          name: b.name,
          imageUrl: b.imageUrl,
          className: b.class?.name ?? 'Unknown',
          rarityName: b.rarity?.name ?? 'Unknown',
          rarityColor: b.rarity?.color ?? '#8b95b8',
          starPowers: b.starPowers.length,
          gadgets: b.gadgets.length,
        }))}
      />
    </div>
  );
}
