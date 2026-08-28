import Image from "next/image";
import Link from "next/link";

import { brawlerPath } from "@/lib/slugs";
import { brawlerIconUrl } from "@/lib/brawlapi";
import { formatNumber, formatPercent } from "@/lib/format";
import type { BABrawler } from "@/types/brawlapi";
import type { ModePick, RankedMapPick } from "@/types/stats";

/**
 * The ranked list of brawlers on a map or in a mode.
 *
 * Takes either kind of pick because they are the same claim with different
 * evidence behind it: a map page falls back to its mode when the map itself is
 * too thinly sampled, and the reader should see one list either way, labelled
 * for what it is rather than restyled.
 */
export function MapPickList({
  picks,
  brawlerMeta,
  emptyLabel,
}: {
  picks: (ModePick | RankedMapPick)[];
  brawlerMeta: Map<number, BABrawler>;
  emptyLabel: string;
}) {
  if (picks.length === 0) {
    return (
      <p className="card p-6 text-sm leading-relaxed text-muted">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ol className="card divide-y divide-border overflow-hidden">
      {picks.map((pick, index) => {
        const meta = brawlerMeta.get(pick.brawlerId);
        // Only present on a map pick: how much better the brawler does here
        // than it does in Ranked generally, which is the map-specific half of
        // the claim.
        const edge =
          "overallScore" in pick ? pick.score - pick.overallScore : null;

        return (
          <li key={pick.brawlerId}>
            {/* Not prefetched: ten brawler links per map page. */}
            <Link
              href={brawlerPath(pick.brawlerId, pick.brawlerName)}
              prefetch={false}
              className="row-interactive flex items-center gap-3 px-4 py-3"
            >
              <span className="w-5 shrink-0 text-center text-sm font-black tabular-nums text-muted">
                {index + 1}
              </span>
              <Image
                src={meta?.imageUrl ?? brawlerIconUrl(pick.brawlerId)}
                alt=""
                width={44}
                height={44}
                className="size-11 shrink-0 rounded-lg bg-surface-2"
                loading="lazy"
                unoptimized
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold capitalize">
                  {pick.brawlerName.toLowerCase()}
                </span>
                <span className="block text-xs tabular-nums text-muted">
                  {formatNumber(pick.decidedSampleSize)} decided battles ·{" "}
                  {formatPercent(pick.winRate)} raw
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-bold tabular-nums text-victory">
                  {formatPercent(pick.score)}
                </span>
                {edge !== null ? (
                  <span
                    className={`block text-xs tabular-nums ${
                      edge >= 0.005 ? "text-victory/80" : "text-muted"
                    }`}
                  >
                    {edge >= 0.005 ? "+" : edge <= -0.005 ? "−" : "±"}
                    {Math.abs(edge * 100).toFixed(1)} vs usual
                  </span>
                ) : (
                  <span className="block text-xs tabular-nums text-muted">
                    {formatPercent(pick.pickRate)} picked
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
