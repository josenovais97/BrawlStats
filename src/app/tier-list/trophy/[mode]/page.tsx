import type { Metadata } from 'next';

import { TierListView } from '@/components/tier-list/tier-list-view';
import { currentMonth } from '@/lib/site';
import { humanizeMode } from '@/lib/format';
import { findBySlug, slugify } from '@/lib/slugs';
import { getFilterableModes } from '@/lib/stats';

interface PageProps {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ window?: string }>;
}

/** Reads aggregated samples, never the live API — cheap to revalidate hourly. */
export const revalidate = 3600;

/**
 * One page per mode, because "best brawlers for gem grab" is its own search
 * and its own answer. The list itself is the shared `TierListView`; only the
 * scope differs.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { mode } = await params;
  const modes = await getFilterableModes(30, 150, 'trophy').catch(() => []);
  const match = findBySlug(modes, mode, (m) => m.mode);
  const label = humanizeMode(match?.mode ?? mode);

  return {
    title: `Best Brawl Stars brawlers for ${label}, trophy ladder (${currentMonth()})`,
    description: `Which brawlers win most in ${label}, ranked by meta score from sampled trophy-ladder battles.`,
    alternates: { canonical: `/tier-list/trophy/${slugify(match?.mode ?? mode)}` },
  };
}

export default async function TrophyModeTierListPage({ params, searchParams }: PageProps) {
  const { mode } = await params;
  return <TierListView format="trophy" searchParams={searchParams} modeSlug={mode} />;
}
