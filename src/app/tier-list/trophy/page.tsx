import type { Metadata } from 'next';

import { TierListView } from '@/components/tier-list/tier-list-view';

export const metadata: Metadata = {
  title: 'Trophy tier list',
  description:
    'Brawl Stars trophy tier list, built from win and pick rates in sampled trophy-ladder battles, showdown included.',
  alternates: { canonical: '/tier-list/trophy' },
};

/** Reads aggregated samples, never the live API — cheap to revalidate hourly. */
export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<{ window?: string; mode?: string }>;
}

export default function TrophyTierListPage({ searchParams }: PageProps) {
  return <TierListView format="trophy" searchParams={searchParams} />;
}
