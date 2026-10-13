import { BrawlerPodium } from '@/components/brawlers/brawler-podium';
import { TIER_COPY, type TierCopy } from '@/components/tier-list/tier-list-copy';
import { fmtDecimal, fmtPercent, type Locale } from '@/lib/i18n';
import { TIER_COLOR } from '@/lib/tiers';
import type { BABrawler } from '@/types/brawlapi';
import type { TierListEntry } from '@/types/stats';

/**
 * The tier list's top three, as the first thing on the page.
 *
 * On a phone the list used to open on its heading and three paragraphs, with
 * not one brawler on the first screen. The answer sentence above stays (it is
 * what search and answer engines quote); this is the same answer as a picture.
 */
export function TierPodium({
  best,
  brawlerMeta,
  copy = TIER_COPY.en,
  locale = 'en',
}: {
  best: TierListEntry[];
  brawlerMeta: Map<number, BABrawler>;
  copy?: TierCopy;
  locale?: Locale;
}) {
  return (
    <BrawlerPodium
      label={copy.podium}
      brawlerMeta={brawlerMeta}
      items={best.slice(0, 3).map((b) => ({
        brawlerId: b.brawlerId,
        brawlerName: b.brawlerName,
        headline: b.metaScore !== null && b.metaScore !== undefined ? fmtDecimal(b.metaScore, locale) : '—',
        detail: copy.podiumDetail(fmtPercent(b.normalizedWinRate, locale)),
        badge: b.tier ? { text: b.tier, color: TIER_COLOR[b.tier] } : undefined,
      }))}
    />
  );
}
