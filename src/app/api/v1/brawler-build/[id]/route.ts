import type { NextRequest } from 'next/server';

import { getBrawlerMap, gearIconUrl } from '@/lib/brawlapi';
import { getOfficialBrawlers } from '@/lib/bs-api';
import { BrawlApiError } from '@/lib/errors';
import { errorResponse, okResponse } from '@/lib/route-helpers';
import { getBrawlerBuild } from '@/lib/stats';

/**
 * GET /api/v1/brawler-build/123
 *
 * What sampled owners of one brawler have unlocked, for the overlay panel.
 *
 * Fetched on tap rather than rendered into the panel, because the panel
 * already carries seven modes of tier data and most brawlers in it are never
 * tapped. Loading ~90 builds to serve the two someone actually looks at would
 * be the larger share of the payload, on a window opened over mobile data.
 *
 * Under `/api/`, which `robots.txt` already disallows — see `lib/crawl-policy`.
 */
export const revalidate = 3600;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const brawlerId = Number((await params).id);
    if (!Number.isInteger(brawlerId) || brawlerId <= 0) {
      return errorResponse(new BrawlApiError('notFound', 'Not a brawler id'));
    }

    const [build, brawlerMeta, official] = await Promise.all([
      getBrawlerBuild(brawlerId),
      getBrawlerMap().catch(() => new Map()),
      getOfficialBrawlers()
        .then((r) => r.items.find((b) => b.id === brawlerId))
        .catch(() => undefined),
    ]);

    if (!build || build.sampleSize === 0) {
      return okResponse({ brawlerId, owners: 0, gears: [], starPower: null, gadget: null });
    }

    // The artwork mirror names star powers and gadgets; the official catalogue
    // is the only place gear names appear.
    const meta = brawlerMeta.get(brawlerId);
    const accessories = new Map<number, { name: string; imageUrl: string }>();
    for (const a of [...(meta?.starPowers ?? []), ...(meta?.gadgets ?? [])]) {
      accessories.set(a.id, { name: a.name, imageUrl: a.imageUrl });
    }
    const gearNames = new Map((official?.gears ?? []).map((g) => [g.id, g.name]));

    /*
     * The most-owned option of a kind, always returned when there is one.
     *
     * These were gated behind a divergence threshold, on the reasoning that
     * owners hold both star powers and both gadgets so the larger half is a
     * coin flip. That is still true, and measured across the sampled pool no
     * brawler's split ever cleared it — which meant the card showed gears and
     * nothing else. The share travels with the item precisely so a 51/49 reads
     * as the tie it is, rather than being hidden on the reader's behalf.
     */
    const ability = (options: typeof build.starPowers) => {
      const top = options[0];
      if (!top) return null;
      const named = accessories.get(top.itemId);
      return {
        itemId: top.itemId,
        name: named?.name ?? `#${top.itemId}`,
        imageUrl: named?.imageUrl ?? null,
        share: top.share,
      };
    };

    return okResponse({
      brawlerId,
      owners: build.sampleSize,
      // Two, because that is how many a player equips.
      gears: build.gears.slice(0, 2).map((g) => ({
        itemId: g.itemId,
        name: gearNames.get(g.itemId) ?? `#${g.itemId}`,
        imageUrl: gearIconUrl(g.itemId),
        share: g.share,
      })),
      starPower: ability(build.starPowers),
      gadget: ability(build.gadgets),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
