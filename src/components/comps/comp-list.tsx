import Image from 'next/image';
import Link from 'next/link';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber, formatPercent, titleCase } from '@/lib/format';
import { brawlerPath } from '@/lib/slugs';
import type { BABrawler } from '@/types/brawlapi';
import type { TeamComp } from '@/lib/stats';

/**
 * The three-brawler compositions that win a mode.
 *
 * Shows the edge over the mode rather than the raw win rate, because the raw
 * number is not comparable to anything a reader knows: this sample wins about
 * 66% of its battles overall — it is drawn from active players — so a comp at
 * 64% is below average despite looking strong. The mode's own rate is the only
 * honest thing to measure against, and it is stated on the page.
 *
 * Names are printed under the portraits, not left to the artwork. The first
 * version showed three icons and nothing else, which reads fine to someone who
 * already knows all 108 brawlers by their crop and is unusable to anyone else —
 * and "anyone else" is who a page called *best team comps* is for.
 *
 * "Used by N players" is as prominent as the battle count on purpose. It is the
 * sample size that decides whether the comp means anything: three friends
 * queueing together can put up 22 straight wins with a comp nobody else plays,
 * and the battle count alone cannot tell that apart from a real one.
 */
export function CompList({
  comps,
  brawlerMeta,
  emptyLabel,
}: {
  comps: TeamComp[];
  brawlerMeta: Map<number, BABrawler>;
  emptyLabel: string;
}) {
  if (comps.length === 0) {
    return <p className="card p-6 text-sm leading-relaxed text-muted">{emptyLabel}</p>;
  }

  return (
    <ol className="card divide-y divide-border overflow-hidden">
      {comps.map((comp, index) => {
        const edgePts = comp.edge * 100;

        return (
          <li
            key={comp.brawlerIds.join('-')}
            className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4"
          >
            <span className="w-5 shrink-0 text-center text-base font-black tabular-nums text-muted/70">
              {index + 1}
            </span>

            {/* The trio reads as one unit rather than three list items: the
                brawlers are joined by "+" and share a single tinted plate. */}
            <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-1 gap-y-2 rounded-xl bg-surface-2/40 p-2">
              {comp.brawlerIds.map((id, i) => {
                const meta = brawlerMeta.get(id);
                const name = meta?.name ? titleCase(meta.name) : `#${id}`;
                return (
                  <div key={id} className="flex items-start gap-1">
                    {i > 0 ? (
                      <span
                        aria-hidden
                        className="self-center px-0.5 text-sm font-bold text-muted/50"
                      >
                        +
                      </span>
                    ) : null}
                    <Link
                      href={brawlerPath(id, meta?.name ?? String(id))}
                      prefetch={false}
                      className="group flex w-[4.5rem] flex-col items-center gap-1 rounded-lg py-1 transition-colors hover:bg-surface-2 sm:w-20"
                    >
                      <Image
                        src={meta?.imageUrl ?? brawlerIconUrl(id)}
                        alt=""
                        width={48}
                        height={48}
                        className="size-11 rounded-lg bg-surface-2 transition-transform group-hover:scale-105 sm:size-12"
                        loading="lazy"
                        unoptimized
                      />
                      <span className="w-full truncate px-0.5 text-center text-[11px] font-semibold leading-tight">
                        {name}
                      </span>
                    </Link>
                  </div>
                );
              })}
            </div>

            <div className="shrink-0 text-right">
              <span
                className={`block text-lg font-black leading-none tabular-nums ${
                  edgePts >= 0.5 ? 'text-victory' : 'text-foreground'
                }`}
              >
                {edgePts >= 0.05 ? '+' : edgePts <= -0.05 ? '−' : '±'}
                {Math.abs(edgePts).toFixed(1)}
              </span>
              <span className="mt-1 block text-xs tabular-nums text-muted">
                {formatPercent(comp.winRate)} won
              </span>
              <span className="mt-0.5 block text-[11px] tabular-nums text-muted/80">
                {formatNumber(comp.battles)} battles · {formatNumber(comp.players)} players
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
