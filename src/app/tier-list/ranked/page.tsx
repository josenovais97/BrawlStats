import type { Metadata } from 'next';

import { TierListView } from '@/components/tier-list/tier-list-view';
import { resolveTierRoute, tierListMetadata } from '@/lib/tier-list-route';

/** Reads aggregated samples, never the live API — cheap to revalidate hourly. */
export const revalidate = 3600;

export function generateMetadata(): Promise<Metadata> {
  return tierListMetadata('ranked', resolveTierRoute('ranked', []));
}

export default function RankedTierListPage() {
  const route = resolveTierRoute('ranked', []);
  return <TierListView format="ranked" windowKey={route.windowKey} modeSlug={route.modeSlug} />;
}
