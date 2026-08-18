import type { Metadata } from 'next';

import { TierListView } from '@/components/tier-list/tier-list-view';

export const metadata: Metadata = {
  title: 'Ranked tier list',
  description:
    'Brawl Stars Ranked tier list, built from win and pick rates in sampled competitive Ranked battles.',
  alternates: { canonical: '/tier-list/ranked' },
};

/** Reads aggregated samples, never the live API — cheap to revalidate hourly. */
export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<{ window?: string; mode?: string }>;
}

export default function RankedTierListPage({ searchParams }: PageProps) {
  return <TierListView format="ranked" searchParams={searchParams} />;
}
