import type { Metadata } from 'next';

import { redirect } from 'next/navigation';

import { tierListHref } from '@/components/tier-list/tier-list-controls';
import { TierListView } from '@/components/tier-list/tier-list-view';
import { currentMonth } from '@/lib/site';
import { isTierWindow } from '@/lib/stats';

/*
 * A function rather than a constant, so the month in the title is the month
 * the page is regenerated in. The page revalidates hourly off a sampler that
 * runs every three hours, so the date is honest.
 */
export function generateMetadata(): Metadata {
  return {
    title: `Brawl Stars Ranked tier list (${currentMonth()})`,
    description: `The best Brawl Stars brawlers in competitive Ranked, ${currentMonth()}. Built from win and pick rates in sampled Ranked battles and updated every few hours.`,
    alternates: { canonical: '/tier-list/ranked' },
  };
}

/** Reads aggregated samples, never the live API — cheap to revalidate hourly. */
export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<{ window?: string; mode?: string }>;
}

export default async function RankedTierListPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // `?mode=` predates the per-mode pages and is still in the wild — in shared
  // links, and in whatever Google has already indexed. Sending it to the path
  // form keeps one canonical URL per mode instead of two that rank against
  // each other.
  if (params.mode) {
    redirect(tierListHref('ranked', isTierWindow(params.window) ? params.window : '7d', params.mode));
  }

  return <TierListView format="ranked" searchParams={searchParams} />;
}
