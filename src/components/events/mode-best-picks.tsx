import Image from "next/image";
import Link from "next/link";

import { brawlerPath } from "@/lib/slugs";
import { brawlerIconUrl } from "@/lib/brawlapi";
import { formatPercent } from "@/lib/format";
import type { BABrawler } from "@/types/brawlapi";
import type { ModeBestPicks } from "@/types/stats";

/**
 * The strongest brawlers for an event card — for the map when the map has been
 * sampled enough, and for the mode otherwise.
 *
 * The scope is always stated. Before, a card next to "Super Beach" showed
 * mode-wide Brawl Ball picks under the heading "Best picks", which reads as a
 * recommendation for that map and is not one. Presenting mode-wide data as
 * map-specific is the kind of quiet overclaim that costs trust when someone
 * acts on it and loses.
 *
 * Ranked on the mode's own baseline rather than a global one. Modes are not
 * equally winnable — a 30% win rate is strong in solo showdown and dreadful in
 * gem grab — so a single cross-mode threshold would rank every showdown
 * brawler last.
 */
export function ModeBestPicks({
  data,
  brawlerMeta,
  accent,
  mapName,
  modeLabel,
  scope,
}: {
  data: ModeBestPicks | undefined;
  brawlerMeta: Map<number, BABrawler>;
  accent: string;
  mapName?: string | null;
  modeLabel?: string;
  /** Which population the picks were actually computed over. */
  scope: "map" | "mode";
}) {
  if (!data || data.picks.length === 0) {
    return (
      <p className="border-t border-border px-4 py-3 text-xs text-muted">
        Not enough sampled battles in this mode yet.
      </p>
    );
  }

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow truncate" style={{ color: accent }}>
          {scope === "map" && mapName
            ? `Best picks for ${mapName}`
            : `Best ${modeLabel ?? "mode"} picks`}
        </p>
        <p className="shrink-0 text-xs tabular-nums text-muted">
          {formatPercent(data.baselineWinRate)} avg
        </p>
      </div>

      {/* Stated on the card itself rather than a page away: someone reading an
          event card is about to queue, and whether this is about their map or
          their mode changes what the list is worth. */}
      {scope === "mode" ? (
        <p className="mt-1 text-xs leading-snug text-muted">
          Map sample too small. Using mode-wide data.
        </p>
      ) : null}

      <ol className="mt-2.5 space-y-1.5">
        {data.picks.map((pick, index) => {
          const meta = brawlerMeta.get(pick.brawlerId);
          return (
            <li key={pick.brawlerId}>
              <Link
                href={brawlerPath(pick.brawlerId, pick.brawlerName)}
                title={`${pick.brawlerName}: ${formatPercent(pick.winRate)} win rate over ${pick.decidedSampleSize} sampled ranked battles in this mode`}
                className="group flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-surface-2"
              >
                <span className="w-3 shrink-0 text-center text-xs font-black tabular-nums text-muted">
                  {index + 1}
                </span>
                <Image
                  src={meta?.imageUrl ?? brawlerIconUrl(pick.brawlerId)}
                  alt=""
                  width={28}
                  height={28}
                  className="size-7 shrink-0 rounded-md"
                  loading="lazy"
                  unoptimized
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold capitalize">
                  {pick.brawlerName.toLowerCase()}
                </span>
                {/*
                  The adjusted score, not the raw rate. Ranking is by adjusted
                  score, and printing the raw one made the column read as
                  mis-sorted whenever a thin sample had a flattering record.
                */}
                <span className="shrink-0 text-xs font-bold tabular-nums text-victory">
                  {formatPercent(pick.score)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
