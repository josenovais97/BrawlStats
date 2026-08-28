import type { Metadata } from "next";

import { TierListView } from "@/components/tier-list/tier-list-view";
import { resolveTierRoute, tierListMetadata } from "@/lib/tier-list-route";

/*
 * Three hours, matching both the sampler and `READ_CACHE_SECONDS`.
 *
 * Declaring longer achieves nothing: these pages read cached aggregates, and a
 * route's revalidate is the shortest-lived cache inside it. This value was
 * briefly 43200, which the build reported as 1h.
 */
export const revalidate = 7200;

/* Runtime ISR. Without an empty `generateStaticParams` a dynamic segment is
   re-rendered per request however short its `revalidate` is. */
export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ scope: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { scope } = await params;
  return tierListMetadata("trophy", resolveTierRoute("trophy", [scope]));
}

/**
 * One page per mode, because "best brawlers for gem grab" is its own search
 * and its own answer. The list itself is the shared `TierListView`; only the
 * scope differs.
 *
 * The segment is a window key when it names one, and a mode slug otherwise —
 * see `resolveTierRoute`, which owns that decision.
 */
export default async function TrophyScopedTierListPage({ params }: PageProps) {
  const { scope } = await params;
  const route = resolveTierRoute("trophy", [scope]);
  return (
    <TierListView
      format="trophy"
      windowKey={route.windowKey}
      modeSlug={route.modeSlug}
    />
  );
}
