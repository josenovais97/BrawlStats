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

export function generateMetadata(): Promise<Metadata> {
  return tierListMetadata("trophy", resolveTierRoute("trophy", []));
}

export default function TrophyTierListPage() {
  const route = resolveTierRoute("trophy", []);
  return (
    <TierListView
      format="trophy"
      windowKey={route.windowKey}
      modeSlug={route.modeSlug}
    />
  );
}
