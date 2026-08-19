import type { Metadata } from 'next';

import { redirect } from 'next/navigation';

import { tierListHref } from '@/components/tier-list/tier-list-controls';
import { TierListView } from '@/components/tier-list/tier-list-view';
import { isTierWindow } from '@/lib/stats';

export const metadata: Metadata = {
  title: 'Brawl Stars trophy tier list',
  description:
    'Brawl Stars trophy tier list, built from win and pick rates in sampled trophy-ladder battles, showdown included.',
  alternates: { canonical: '/tier-list/trophy' },
};

/** Reads aggregated samples, never the live API — cheap to revalidate hourly. */
export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<{ window?: string; mode?: string }>;
}

export default async function TrophyTierListPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // `?mode=` predates the per-mode pages and is still in the wild — in shared
  // links, and in whatever Google has already indexed. Sending it to the path
  // form keeps one canonical URL per mode instead of two that rank against
  // each other.
  if (params.mode) {
    redirect(tierListHref('trophy', isTierWindow(params.window) ? params.window : '7d', params.mode));
  }

  return <TierListView format="trophy" searchParams={searchParams} />;
}
