import Image from 'next/image';
import Link from 'next/link';

import { brawlerPath } from '@/lib/slugs';
import { TIER_COLOR } from '@/lib/stats';
import { formatNumber, formatPercent, humanizeMode } from '@/lib/format';
import type { TierListEntry } from '@/types/stats';

/**
 * Brawlers that win often and are picked rarely.
 *
 * The opposite corner from `MostPicked`, and the reason both exist: that
 * component answers "what will I run into", the tiers answer "what is good",
 * and neither surfaces the gap between them. A brawler with a strong adjusted
 * win rate that almost nobody plays is the most actionable thing on the page —
 * it is a pick available to you that the people you are queuing against are
 * not preparing for.
 *
 * This is NOT a ban list, and the distinction matters enough to state.
 * Supercell's API does not publish Ranked draft bans: a battle log records
 * what was played, with no ban field and no pick order. A brawler nobody picks
 * and a brawler everybody bans produce exactly the same evidence — absence —
 * so a "most banned" ranking built on this data would be an invention. What is
 * measurable is that these brawlers win when they are used and are seldom
 * used, and that is what the heading claims.
 *
 * Rated brawlers only, unlike `MostPicked`. A pick rate is a count and is sound
 * from the first battle; the claim here is about a *win rate*, which needs the
 * sample floor behind it or it is just noise with a small denominator.
 */
export function Underrated({
  entries,
  limit,
  mode,
  windowLabel,
  battlesLabel,
}: {
  /** Rated entries only — see above. */
  entries: TierListEntry[];
  limit: number;
  /** Active mode filter, for the caption. */
  mode?: string;
  /** e.g. "7d", matching the control above. */
  windowLabel: string;
  /** What the sample counts, e.g. "Ranked battles". */
  battlesLabel: string;
}) {
  const withRates = entries.filter(
    (entry) => entry.normalizedWinRate !== null && (entry.usageRate ?? 0) > 0,
  );
  if (withRates.length === 0) return null;

  /*
   * "Rarely picked" has to be relative to this sample, not to a fixed
   * threshold. Pick rates differ by an order of magnitude between a
   * thirteen-mode ladder list and a single competitive mode, so a hard cutoff
   * would either select everything or nothing depending on which page it ran
   * on. The median splits the roster the same way whatever the scale.
   */
  const usages = withRates.map((entry) => entry.usageRate ?? 0).sort((a, b) => a - b);
  const medianUsage = usages[Math.floor(usages.length / 2)];

  const top = withRates
    .filter((entry) => (entry.usageRate ?? 0) <= medianUsage)
    // Best record first. Among the less-picked half, this is simply "who wins
    // most" — no composite score, because a second weighting would make the
    // ordering harder to explain than the finding is worth.
    .sort((a, b) => (b.normalizedWinRate ?? 0) - (a.normalizedWinRate ?? 0))
    .slice(0, limit);

  // Two rows is not a finding, it is a coincidence with a heading on it.
  if (top.length < 3) return null;

  return (
    <section aria-labelledby="underrated">
      <h2 id="underrated" className="display text-2xl uppercase">
        Strong but rarely picked
      </h2>
      <p className="mb-4 mt-1 max-w-3xl text-sm leading-relaxed text-muted">
        Brawlers with the best adjusted win rates among the less-played half of the
        roster, from sampled {battlesLabel}
        {mode ? ` in ${humanizeMode(mode)}` : ''} over the {windowLabel} window. They
        win when they are used and are not used much &mdash; which usually means
        they are underrated rather than bad.
      </p>

      <ol className="grid gap-2 sm:grid-cols-2">
        {top.map((entry, index) => (
          <li key={entry.brawlerId}>
            <Link
              href={brawlerPath(entry.brawlerId, entry.brawlerName)}
              prefetch={false}
              title={`${entry.brawlerName}: ${formatPercent(entry.normalizedWinRate)} adjusted win rate over ${formatNumber(entry.decidedSampleSize)} decided battles, ${formatPercent(entry.usageRate)} pick rate`}
              className="row-interactive flex items-center gap-3 rounded-lg p-2"
            >
              <span className="w-5 shrink-0 text-right text-sm font-bold tabular-nums text-muted">
                {index + 1}
              </span>
              {entry.imageUrl ? (
                <Image
                  src={entry.imageUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 shrink-0"
                  unoptimized
                />
              ) : (
                <span className="size-8 shrink-0 rounded bg-surface-2" />
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold capitalize">
                  {entry.brawlerName.toLowerCase()}
                </span>
                {/* Both numbers, because either alone is misleading: the win
                    rate without the pick rate reads as a tier claim, and the
                    pick rate without the win rate reads as an insult. */}
                <span className="block text-xs text-muted">
                  {formatPercent(entry.usageRate)} pick rate
                </span>
              </span>

              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-xs font-black"
                style={{
                  background: `color-mix(in srgb, ${TIER_COLOR[entry.tier]} 18%, transparent)`,
                  color: TIER_COLOR[entry.tier],
                }}
              >
                {entry.tier}
              </span>
              <span className="w-14 shrink-0 text-right text-sm font-bold tabular-nums text-victory">
                {formatPercent(entry.normalizedWinRate)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
