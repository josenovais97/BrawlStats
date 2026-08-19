import Image from 'next/image';
import Link from 'next/link';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber, formatPercent } from '@/lib/format';
import type { BrawlerPairing, BrawlerPairings } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';

/**
 * Who this brawler beats, who beats it, and who it wants beside it.
 *
 * Every number is an edge against this brawler's own win rate in the same
 * sample, never an absolute. A brawler that wins 58% of everything is not
 * "strong against" the opponent it wins 55% against — the absolute number
 * would say it was, and that is the reading this framing prevents.
 */
export function BrawlerMatchups({
  pairings,
  brawlerName,
  brawlerMeta,
}: {
  pairings: BrawlerPairings;
  brawlerName: string;
  brawlerMeta: Map<number, BABrawler>;
}) {
  const name = brawlerName.toLowerCase();
  const columns: { title: string; hint: string; rows: BrawlerPairing[] }[] = [
    {
      title: 'Strong against',
      hint: `Opponents ${name} beats more often than its own average`,
      rows: pairings.strongAgainst,
    },
    {
      title: 'Weak against',
      hint: `Opponents that pull ${name} below its own average`,
      rows: pairings.weakAgainst,
    },
    {
      title: 'Best team-mates',
      hint: `Allies ${name} wins more alongside`,
      rows: pairings.bestWith,
    },
  ];

  const withRows = columns.filter((column) => column.rows.length > 0);
  if (withRows.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-3">
        {withRows.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
              {column.title}
            </h3>
            <p className="mb-2 text-xs text-muted/80">{column.hint}</p>
            <ul className="card divide-y divide-border overflow-hidden">
              {column.rows.map((row) => {
                const meta = brawlerMeta.get(row.brawlerId);
                const positive = row.edge > 0;

                return (
                  <li key={row.brawlerId}>
                    <Link
                      href={`/brawlers/${row.brawlerId}`}
                      className="row-interactive flex items-center gap-3 px-3 py-2"
                      title={`${formatPercent(row.winRate)} win rate over ${formatNumber(row.decidedSampleSize)} sampled battles, against a ${formatPercent(pairings.baseline)} average for this brawler`}
                    >
                      <Image
                        src={meta?.imageUrl ?? brawlerIconUrl(row.brawlerId)}
                        alt=""
                        width={34}
                        height={34}
                        className="size-[34px] shrink-0 rounded-md bg-surface-2"
                        loading="lazy"
                        unoptimized
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold capitalize">
                          {(meta?.name ?? `#${row.brawlerId}`).toLowerCase()}
                        </span>
                        <span className="block text-[0.625rem] tabular-nums text-muted">
                          {formatNumber(row.decidedSampleSize)} battles
                        </span>
                      </span>
                      <span
                        className={`shrink-0 text-sm font-bold tabular-nums ${
                          positive ? 'text-victory' : 'text-defeat'
                        }`}
                      >
                        {positive ? '+' : '−'}
                        {Math.abs(row.edge * 100).toFixed(1)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-muted">
        Percentage points above or below this brawler&rsquo;s own{' '}
        {formatPercent(pairings.baseline)} win rate across{' '}
        {formatNumber(pairings.sampleSize)} sampled team battles. Counted once per
        battle from one player&rsquo;s side, and kept out of the win-rate and pick-rate
        numbers above — those would be skewed by counting every participant.
      </p>
    </div>
  );
}
