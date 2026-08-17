import Image from 'next/image';
import Link from 'next/link';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatPercent } from '@/lib/format';
import type { BABrawler } from '@/types/brawlapi';
import type { ModeBestPicks } from '@/types/stats';

/**
 * The three strongest brawlers in one game mode, shown inside an event card.
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
}: {
  data: ModeBestPicks | undefined;
  brawlerMeta: Map<number, BABrawler>;
  accent: string;
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
        <p className="eyebrow" style={{ color: accent }}>
          Best picks
        </p>
        <p className="text-[0.625rem] tabular-nums text-muted">
          {formatPercent(data.baselineWinRate)} mode avg
        </p>
      </div>

      <ol className="mt-2.5 space-y-1.5">
        {data.picks.map((pick, index) => {
          const meta = brawlerMeta.get(pick.brawlerId);
          return (
            <li key={pick.brawlerId}>
              <Link
                href={`/brawlers/${pick.brawlerId}`}
                title={`${pick.brawlerName}: ${formatPercent(pick.winRate)} win rate over ${pick.decidedSampleSize} sampled ranked battles in this mode`}
                className="group flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-surface-2"
              >
                <span className="w-3 shrink-0 text-center text-[0.625rem] font-black tabular-nums text-muted">
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
