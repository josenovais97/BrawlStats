import type { Metadata } from 'next';

import { TierListView } from '@/components/tier-list/tier-list-view';
import { RANK_BRACKETS } from '@/lib/rank-brackets';
import { bracketTierListMetadata, resolveBracket } from '@/lib/tier-list-route';
import { DEFAULT_TIER_WINDOW } from '@/lib/stats';

/* Same cadence as the other tier lists: the sampler's. */
export const revalidate = 7200;

/* Four brackets, all known ahead of time. Prebuilt at runtime like the rest. */
export async function generateStaticParams() {
  return RANK_BRACKETS.map((b) => ({ bracket: b.slug }));
}
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ bracket: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { bracket } = await params;
  return bracketTierListMetadata(resolveBracket(bracket));
}

/** The Ranked tier list for one bracket of lobbies. See lib/rank-brackets. */
export default async function BracketTierListPage({ params }: PageProps) {
  const { bracket } = await params;
  return (
    <TierListView format="ranked" windowKey={DEFAULT_TIER_WINDOW} bracket={resolveBracket(bracket)} />
  );
}
