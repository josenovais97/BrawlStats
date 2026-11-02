import type { Metadata } from 'next';

import { CosmeticList } from '@/components/cosmetics/cosmetic-list';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading } from '@/components/ui/section-heading';
import { formatNumber } from '@/lib/format';
import { fankitSkin } from '@/lib/fankit';
import { getSkinCatalogue } from '@/lib/stats';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';

export const metadata: Metadata = {
  title: 'Every Brawl Stars skin, ranked by how many players wear it',
  description:
    'The full skin catalogue measured from sampled accounts: which skins are actually equipped, and which almost nobody uses. Searchable by skin or brawler.',
  alternates: { canonical: '/cosmetics/skins' },
};

/** Matches READ_CACHE_SECONDS; the read below is cached for two hours. */
export const revalidate = 7200;

export default async function SkinCataloguePage() {
  const t = getT(requestLocale());
  const skins = await getSkinCatalogue();

  // Resolved here, not in the client component: the Fan Kit index lives in
  // lib/fankit and the browser has no reason to download it.
  const art: Record<string, string> = {};
  for (const skin of skins) {
    const url = skin.brawlerId ? fankitSkin(skin.brawlerId, skin.brawlerName ?? '', skin.name) : null;
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
        title={t('Skins')}
        subtitle={
          skins.length > 0
            ? t('{length} skins seen in the sampled pool, ranked by share of player-brawler slots. Default skins are excluded.', { length: formatNumber(skins.length) })
            : t('No skin data has been sampled yet.')
        }
      />

      {skins.length > 0 ? (
        <CosmeticList items={skins} kind="skin" art={art} />
      ) : (
        <p className="card p-6 text-sm text-muted">{t('Nothing sampled yet. The pool refreshes every two hours.')}</p>
      )}
    </div>
  );
}
