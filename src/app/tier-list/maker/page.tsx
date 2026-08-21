import type { Metadata } from 'next';
import Link from 'next/link';

import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { TierMaker, type MakerBrawler } from '@/components/tier-list/tier-maker';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeading } from '@/components/ui/section-heading';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { getMetaIndex } from '@/lib/stats';
import { TIER_ORDER } from '@/lib/tiers';
import type { Tier } from '@/types/stats';

export const metadata: Metadata = {
  title: 'Brawl Stars tier list maker. Build and share your own',
  description:
    'Rank every Brawl Stars brawler yourself and share it with one link. Start from a blank board or from the live Ranked meta, then argue with it.',
  alternates: { canonical: '/tier-list/maker' },
};

/** The roster and the meta both move; hourly matches the tier list itself. */
export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Decodes a shared board from the URL.
 *
 * The share link carries one parameter per tier — `?s=4.11&a=1.5` — holding
 * short brawler ids in placement order. Short because the full ids all begin
 * with the same eight digits, and a link that has to survive being pasted into
 * a chat app should not spend a hundred characters saying "16000000" over and
 * over.
 *
 * Everything is validated against the real catalogue rather than trusted: the
 * parameter is user-editable, so an unknown id is dropped rather than rendered
 * as a broken tile.
 */
function decodeBoard(
  params: Record<string, string | string[] | undefined>,
  known: Set<number>,
): Record<number, Tier> {
  const board: Record<number, Tier> = {};

  for (const tier of TIER_ORDER) {
    const raw = params[tier.toLowerCase()];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value) continue;

    for (const part of value.split('.')) {
      const id = 16_000_000 + Number(part);
      if (!Number.isFinite(id) || !known.has(id)) continue;
      // First tier wins, so a hand-edited link listing an id twice cannot put
      // one brawler in two rows.
      if (board[id] === undefined) board[id] = tier;
    }
  }

  return board;
}

/**
 * The tier list maker.
 *
 * Every tier list on this site so far is measured — sampled battles, scored
 * the same way every time, and not open to opinion. That is the honest thing
 * to publish and it is also, for a lot of people, the least fun thing on the
 * site. A tier list is something players want to *make* and argue about, and
 * the argument is more interesting here than anywhere else precisely because
 * the measured answer is one click away to disagree with.
 *
 * Costs nothing to run: the board lives entirely in the share link, so there
 * is no table of saved tier lists, no accounts, and nothing to prune.
 */
export default async function TierMakerPage({ searchParams }: PageProps) {
  const [params, catalog] = await Promise.all([
    searchParams,
    getBrawlerCatalog().catch(() => null),
  ]);

  if (!catalog || catalog.current.length === 0) {
    return (
      <ErrorState
        code="upstreamDown"
        title="Brawler data unavailable"
        detail="The brawler metadata source is not responding, so there is nothing to rank yet. Try again shortly."
      />
    );
  }

  // Falls back to an empty index: a maker with no meta is still a maker, it
  // just cannot offer to prefill from it.
  const meta = await getMetaIndex('ranked', 7).catch(() => new Map());

  const brawlers: MakerBrawler[] = catalog.current.map((brawler) => ({
    id: brawler.id,
    name: brawler.name,
    imageUrl: brawler.meta?.imageUrl ?? brawlerIconUrl(brawler.id),
    metaTier: meta.get(brawler.id)?.tier ?? null,
  }));

  const initial = decodeBoard(params, new Set(brawlers.map((b) => b.id)));

  return (
    <div className="space-y-6">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Tier list', path: '/tier-list' },
          { name: 'Maker', path: '/tier-list/maker' },
        ])}
      />

      <PageHeading
        eyebrow="Your call"
        title="Tier list maker"
        subtitle="Rank all 100-odd brawlers yourself, then share the board with one link. Tap a brawler and tap a tier, or drag if you are on a desktop."
      />

      <TierMaker brawlers={brawlers} initial={initial} />

      <p className="text-xs leading-relaxed text-muted">
        Nothing here is saved on a server — the link <em>is</em> the tier list, so
        it keeps working for as long as anyone has it. For the measured version,
        built from sampled battles rather than opinion, see the{' '}
        <Link href="/tier-list/ranked" className="font-medium text-brand hover:underline">
          Ranked tier list
        </Link>{' '}
        or the{' '}
        <Link href="/tier-list/trophy" className="font-medium text-brand hover:underline">
          trophy list
        </Link>
        .
      </p>
    </div>
  );
}
