import type { Metadata } from 'next';

import { CosmeticList } from '@/components/cosmetics/cosmetic-list';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading } from '@/components/ui/section-heading';
import { formatNumber } from '@/lib/format';
import { getIconCatalogue } from '@/lib/stats';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';

export const metadata: Metadata = {
  title: 'Every Brawl Stars profile icon, ranked by how many players use it',
  description:
    'The full profile icon catalogue measured from sampled accounts: which icons players actually wear, and which are almost never seen.',
  alternates: { canonical: '/cosmetics/icons' },
};

/** Matches READ_CACHE_SECONDS; the read below is cached for two hours. */
export const revalidate = 7200;

/**
 * Icons are the easy half of the catalogue: unlike skins they have artwork at
 * a predictable URL, and they sit on the account rather than per brawler, so
 * the share is simply the fraction of sampled players wearing one.
 */
export default async function IconCataloguePage() {
  const t = getT(requestLocale());
  const icons = await getIconCatalogue();

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Cosmetics', path: '/cosmetics' },
          { name: 'Profile icons', path: '/cosmetics/icons' },
        ])}
      />

      <PageHeading
        title={t('Profile icons')}
        subtitle={
          icons.length > 0
            ? t('{length} icons seen on sampled accounts, ranked by share of players.', { length: formatNumber(icons.length) })
            : t('No icon data has been sampled yet.')
        }
      />

      {icons.length > 0 ? (
        <CosmeticList items={icons} kind="icon" />
      ) : (
        <p className="card p-6 text-sm text-muted">{t('Nothing sampled yet. The pool refreshes every two hours.')}</p>
      )}
    </div>
  );
}
