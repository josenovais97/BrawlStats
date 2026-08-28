import { tierListOgImage, type TierListOgEntry } from '@/components/seo/tier-list-og';
import { currentMonth } from '@/lib/site';
import { getMetaIndex } from '@/lib/stats';

export const alt = 'Brawl Stars trophy tier list';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export const revalidate = 3600;

export default async function Image() {
  const index = await getMetaIndex('trophy', 7).catch(() => new Map());

  const top: TierListOgEntry[] = [...index.values()]
    .filter((entry) => entry.tier !== null && entry.metaScore !== null)
    .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
    .slice(0, 3)
    .map((entry) => ({
      brawlerId: entry.brawlerId,
      name: entry.brawlerName,
      tier: entry.tier!,
      metaScore: entry.metaScore!,
    }));

  return tierListOgImage({
    heading: 'Trophy tier list',
    scope: `The trophy ladder, ${currentMonth()} · updated every few hours`,
    accent: '#ffc53d',
    top,
    size,
  });
}
