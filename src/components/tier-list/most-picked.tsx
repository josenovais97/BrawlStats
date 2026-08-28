import Image from "next/image";
import Link from "next/link";

import { brawlerPath } from "@/lib/slugs";
import { TIER_COLOR } from "@/lib/stats";
import { formatNumber, formatPercent, humanizeMode } from "@/lib/format";
import type { TierListEntry } from "@/types/stats";

/**
 * The brawlers that get picked most, which is a different question from the
 * one the tier list answers.
 *
 * The tiers rank by meta score, where pick rate is only a tie-breaker on an
 * adjusted win rate — deliberately, so a brawler nobody plays cannot be rated
 * the same as a staple with identical results. That makes the tier list a
 * ranking of how *good* a brawler is, and leaves "what am I actually going to
 * run into" unanswered anywhere on the page. Popularity and strength diverge
 * often enough to be worth showing side by side: a comfort pick with a
 * mediocre record sits high here and low above, and that gap is information.
 *
 * Unlike the meta movers below, this follows the window and mode controls
 * exactly — it is computed from the same rows the tiers are, so filtering the
 * page filters this too and no caption is needed to explain a mismatch.
 */
export function MostPicked({
  entries,
  limit,
  mode,
  windowLabel,
  battlesLabel,
}: {
  entries: TierListEntry[];
  limit: number;
  /** Active mode filter, for the caption. */
  mode?: string;
  /** e.g. "7d", matching the control above. */
  windowLabel: string;
  /** What the sample counts, e.g. "Ranked battles". */
  battlesLabel: string;
}) {
  /*
   * Every sampled brawler is eligible, not just the rated ones.
   *
   * The tier list needs enough *decided* battles before a win rate means
   * anything, but a pick rate is sound from the first battle — it is a count,
   * not an average. Excluding unrated brawlers would drop exactly the ones
   * whose popularity is most worth knowing about: a brawler picked constantly
   * in a mode too new or too niche to have a rated win rate.
   */
  const top = entries
    .filter((entry) => (entry.usageRate ?? 0) > 0)
    .sort((a, b) => (b.usageRate ?? 0) - (a.usageRate ?? 0))
    .slice(0, limit);

  if (top.length === 0) return null;

  // The leader sets the bar width, so the shape of the drop-off is visible
  // rather than every bar sitting near-empty against a 100% scale that nothing
  // ever approaches — the top pick in a healthy meta is single-digit percent.
  const peak = top[0].usageRate ?? 0;

  return (
    <section aria-labelledby="most-picked">
      <h2 id="most-picked" className="display text-2xl uppercase">
        Most picked brawlers
      </h2>
      <p className="mb-4 mt-1 max-w-3xl text-sm leading-relaxed text-muted">
        The brawlers appearing in the most sampled {battlesLabel}
        {mode ? ` in ${humanizeMode(mode)}` : ""} over the {windowLabel} window.
        This is popularity, not strength &mdash; the tiers above rank how well a
        brawler performs, and the two disagree often. A pick rate is a share of
        all battles sampled, so it sums across the roster rather than to 100%
        per battle.
      </p>

      <ol className="grid gap-2 sm:grid-cols-2">
        {top.map((entry, index) => {
          const usage = entry.usageRate ?? 0;
          return (
            <li key={entry.brawlerId}>
              <Link
                href={brawlerPath(entry.brawlerId, entry.brawlerName)}
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
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold capitalize">
                      {entry.brawlerName.toLowerCase()}
                    </span>
                    {/* The tier next to the pick rate is the whole point of the
                        section: it shows at a glance where popular and good
                        part company. */}
                    {entry.metaScore !== null ? (
                      <span
                        className="shrink-0 text-xs font-bold"
                        style={{ color: TIER_COLOR[entry.tier] }}
                        title={`Tier ${entry.tier} on this list`}
                      >
                        {entry.tier}
                      </span>
                    ) : null}
                  </span>

                  <span
                    className="mt-1 block h-1 rounded-full bg-surface-2"
                    aria-hidden
                  >
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{
                        width: `${peak > 0 ? (usage / peak) * 100 : 0}%`,
                      }}
                    />
                  </span>

                  <span className="mt-1 block truncate text-xs tabular-nums text-muted">
                    {formatNumber(entry.sampleSize)} battles
                    {entry.winRate !== null ? (
                      <> · {formatPercent(entry.winRate)} win</>
                    ) : null}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold tabular-nums">
                    {formatPercent(usage)}
                  </span>
                  <span className="block text-xs uppercase tracking-wide text-muted">
                    pick
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
