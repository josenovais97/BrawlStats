import type { Metadata } from 'next';

import { CosmeticList } from '@/components/cosmetics/cosmetic-list';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading } from '@/components/ui/section-heading';
import { formatNumber } from '@/lib/format';
import { getSkinArt, skinArtUrl } from '@/lib/skin-art';
import { getSkinCatalogue } from '@/lib/stats';

export const metadata: Metadata = {
  title: 'Every Brawl Stars skin, ranked by how many players wear it',
  description:
    'The full skin catalogue measured from sampled accounts: which skins are actually equipped, and which almost nobody uses. Searchable by skin or brawler.',
  alternates: { canonical: '/cosmetics/skins' },
};

/** Matches READ_CACHE_SECONDS; the read below is cached for two hours. */
export const revalidate = 7200;

export default async function SkinCataloguePage() {
  const [skins, wikiArt] = await Promise.all([getSkinCatalogue(), getSkinArt()]);

  // Resolved here, not in the client component: the matching rules live in
  // lib/skin-art and the browser has no reason to learn them.
  const art: Record<string, string> = {};
  for (const skin of skins) {
    const url = skinArtUrl(wikiArt, skin.brawlerName ?? '', skin.name);
    if (url) art[`${skin.brawlerName ?? ''}|${skin.name}`] = url;
  }

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Cosmetics', path: '/cosmetics' },
          { name: 'Skins', path: '/cosmetics/skins' },
        ])}
      />

      <PageHeading
        title="Skins"
        eyebrow="Cosmetics"
        subtitle={
          skins.length > 0
            ? `${formatNumber(skins.length)} skins seen in the sampled pool, ranked by share of player-brawler slots. Default skins are excluded.`
            : 'No skin data has been sampled yet.'
        }
      />

      {skins.length > 0 ? (
        <CosmeticList items={skins} kind="skin" art={art} />
      ) : (
        <p className="card p-6 text-sm text-muted">
          Nothing sampled yet. The pool refreshes every two hours.
        </p>
      )}
    </div>
  );
}
