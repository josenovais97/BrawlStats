import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { TierMaker, type MakerBrawler } from '@/components/tier-list/tier-maker';
import { ErrorState } from '@/components/ui/error-state';
import { TierMakerSkeleton } from '@/components/ui/skeletons';
import { PageHeading } from '@/components/ui/section-heading';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBrawlerArtMap, getBrawlerCatalog } from '@/lib/brawler-catalog';
import { getMetaIndex } from '@/lib/stats';
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

export const metadata: Metadata = {
  title: 'Brawl Stars tier list maker. Build and share your own',
  description:
    'Rank every Brawl Stars brawler yourself and share it with one link. Start from a blank board or from the live Ranked meta, then argue with it.',
  alternates: { canonical: '/tier-list/maker' },
};

/** The roster and the meta both move; hourly matches the tier list itself. */
export const revalidate = 3600;

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
export default async function TierMakerPage() {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const catalog = await getBrawlerCatalog().catch(() => null);

  if (!catalog || catalog.current.length === 0) {
    return (
      <ErrorState
        code="upstreamDown"
        title={t('Brawler data unavailable')}
        detail={t('The brawler metadata source is not responding, so there is nothing to rank yet. Try again shortly.')}
      />
    );
  }

  // Falls back to an empty index: a maker with no meta is still a maker, it
  // just cannot offer to prefill from it.
  const meta = await getMetaIndex('ranked', 7).catch(() => new Map());
  // The tier lists' art: the mirror's tile, or the wiki portrait while the
  // mirror has a new brawler's details but not its picture (Cosmo and Vince,
  // October 2026). The maker read the mirror only and showed them broken.
  const art = await getBrawlerArtMap().catch(() => new Map());

  const brawlers: MakerBrawler[] = catalog.current.map((brawler) => ({
    id: brawler.id,
    name: brawler.name,
    imageUrl: art.get(brawler.id)?.imageUrl ?? brawler.meta?.imageUrl ?? brawlerIconUrl(brawler.id),
    metaTier: meta.get(brawler.id)?.tier ?? null,
  }));

  return (
    <div className="space-y-6">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Tier list', path: '/tier-list' },
          { name: 'Maker', path: '/tier-list/maker' },
        ])}
      />

      <PageHeading
        eyebrow={t('Your call')}
        title={t('Tier list maker')}
        subtitle={t('Rank all 100-odd brawlers yourself, then share the board with one link. Tap a brawler and tap a tier, or drag if you are on a desktop.')}
      />

      {/* The board comes out of the query string, which only the browser
          reads now — so this needs a boundary to suspend behind while the
          page itself stays static. */}
      <Suspense fallback={<TierMakerSkeleton />}>
        <TierMaker brawlers={brawlers} />
      </Suspense>

      <section className="card space-y-3 p-6 text-sm leading-relaxed text-muted">
        <h2 className="text-base font-bold text-foreground">{t('How to make a Brawl Stars tier list')}</h2>
        <p>{t('Every brawler in the game starts in the pool under the board. Tap one, then tap the tier it belongs in; on a computer you can drag it instead. Tap a placed brawler to send it back to the pool, or start from the live Ranked list with one button and argue with the meta instead of starting from scratch.')}</p>
        <p>{t('When it is done, copy the link or save the board as an image and post it. Whoever opens the link sees your exact board and can change it to make their own, which is how most tier list arguments in a club chat start.')}</p>
        <p>{t('A useful tip: rank for one mode or one rank at a time. A brawler that dominates Gem Grab can be a liability in Knockout, and the meta in Masters is not the meta in Gold, so a single board for everything ends up ranking nobody\'s game.')}</p>
      </section>

      <p className="text-xs leading-relaxed text-muted">{t('Nothing here is saved on a server — the link')}{' '}<em>{t('is')}</em>{' '}{t('the tier list, so it keeps working for as long as anyone has it. For the measured version, built from sampled battles rather than opinion, see the')}{' '}
        <Link href={lp('/tier-list/ranked')} className="font-medium text-brand hover:underline">{t('Ranked tier list')}</Link>{' '}{t('or the')}{' '}
        <Link href={lp('/tier-list/trophy')} className="font-medium text-brand hover:underline">{t('trophy list')}</Link>
        .
      </p>
    </div>
  );
}
