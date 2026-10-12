import type { Metadata } from 'next';

import { TierListView } from '@/components/tier-list/tier-list-view';
import { bracketTierListMetadata, resolveBracket } from '@/lib/tier-list-route';
import { DEFAULT_TIER_WINDOW } from '@/lib/stats';

export const revalidate = 7200;

/* Runtime ISR, as on the other mode pages. */
export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ bracket: string; scope: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { bracket, scope } = await params;
  return bracketTierListMetadata(resolveBracket(bracket), scope);
}

/** One mode at one bracket. An unknown mode 404s in `TierListView`. */
export default async function BracketModeTierListPage({ params }: PageProps) {
  const { bracket, scope } = await params;
  return (
    <TierListView
      format="ranked"
      windowKey={DEFAULT_TIER_WINDOW}
      modeSlug={scope}
      bracket={resolveBracket(bracket)}
    />
  );
}
