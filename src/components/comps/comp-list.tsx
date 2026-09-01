import Image from 'next/image';
import Link from 'next/link';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber, formatPercent } from '@/lib/format';
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
 * "Used by N players" is shown as prominently as the battle count on purpose.
 * It is the sample size that decides whether the comp means anything: three
 * friends queueing together can put up 22 straight wins with a comp nobody else
 * plays, and the battle count alone cannot tell that apart from a real one.
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
            className="flex items-center gap-3 px-4 py-3 sm:gap-4"
          >
            <span className="w-5 shrink-0 text-center text-sm font-black tabular-nums text-muted">
              {index + 1}
            </span>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex shrink-0 items-center gap-1.5">
                {comp.brawlerIds.map((id) => {
                  const meta = brawlerMeta.get(id);
                  return (
                    <Link
                      key={id}
                      href={brawlerPath(id, meta?.name ?? String(id))}
                      prefetch={false}
                      title={meta?.name ?? undefined}
                      className="shrink-0 rounded-lg transition-transform hover:scale-105"
                    >
                      <Image
                        src={meta?.imageUrl ?? brawlerIconUrl(id)}
                        alt={meta?.name ?? ''}
                        width={44}
                        height={44}
                        className="size-10 rounded-lg bg-surface-2 sm:size-11"
                        loading="lazy"
                        unoptimized
                      />
                    </Link>
                  );
                })}
              </div>

              <span className="min-w-0 text-xs tabular-nums text-muted">
                {formatNumber(comp.battles)} battles · used by {formatNumber(comp.players)} players
              </span>
            </div>

            <span className="shrink-0 text-right">
              <span
                className={`block font-bold tabular-nums ${
                  edgePts >= 0.5 ? 'text-victory' : 'text-foreground'
                }`}
              >
                {edgePts >= 0.05 ? '+' : edgePts <= -0.05 ? '−' : '±'}
                {Math.abs(edgePts).toFixed(1)}
              </span>
              <span className="block text-xs tabular-nums text-muted">
                {formatPercent(comp.winRate)} won
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
