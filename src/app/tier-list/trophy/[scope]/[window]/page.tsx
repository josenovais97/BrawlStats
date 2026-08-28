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

/* Runtime ISR. See the parent route. */
export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ scope: string; window: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { scope, window } = await params;
  return tierListMetadata(
    "trophy",
    resolveTierRoute("trophy", [scope, window]),
  );
}

/** A mode at a non-default window. Any other shape 404s in `resolveTierRoute`. */
export default async function TrophyScopedWindowTierListPage({
  params,
}: PageProps) {
  const { scope, window } = await params;
  const route = resolveTierRoute("trophy", [scope, window]);
  return (
    <TierListView
      format="trophy"
      windowKey={route.windowKey}
      modeSlug={route.modeSlug}
    />
  );
}
