import Image from 'next/image';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber } from '@/lib/format';
import type { MapMatchup } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';

/**
 * Matchups that only hold on this map.
 *
 * Read as a sentence: "Nita beats Shelly here, +9.4 points above her usual
 * record on this map". The comparison is to the same brawler on the same map,
 * so a map that simply suits a brawler does not make all of its matchups look
 * like wins — without that, the list would just repeat the map's tier order.
 *
 * Short by design. The full grid is eleven thousand cells per map and almost
 * all of them are empty; what is worth printing is the handful with enough
 * battles behind them to survive the same 40-battle floor the comps use.
 */
export function MapMatchups({
  matchups,
  brawlerMeta,
}: {
  matchups: MapMatchup[];
  brawlerMeta: Map<number, BABrawler>;
}) {
  if (matchups.length === 0) return null;

  const name = (id: number) => brawlerMeta.get(id)?.name?.toLowerCase() ?? `#${id}`;

  return (
    <ul className="card divide-y divide-border overflow-hidden">
      {matchups.map((m) => {
        const favoured = m.edge > 0;
        return (
          <li
            key={`${m.brawlerId}-${m.againstBrawlerId}`}
            className="flex items-center gap-3 px-4 py-3"
          >
            <Image
              src={brawlerMeta.get(m.brawlerId)?.imageUrl ?? brawlerIconUrl(m.brawlerId)}
              alt=""
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-lg bg-surface-2"
              loading="lazy"
              unoptimized
            />
            <span className="min-w-0 flex-1 text-sm leading-snug">
              <span className="font-semibold capitalize">{name(m.brawlerId)}</span>{' '}
              <span className="text-muted">{favoured ? 'beats' : 'loses to'}</span>{' '}
              <span className="font-semibold capitalize">{name(m.againstBrawlerId)}</span>
              <span className="block text-xs tabular-nums text-muted">
                {formatNumber(m.battles)} battles here
              </span>
            </span>
            <Image
              src={
                brawlerMeta.get(m.againstBrawlerId)?.imageUrl ??
                brawlerIconUrl(m.againstBrawlerId)
              }
              alt=""
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-lg bg-surface-2 opacity-70"
              loading="lazy"
              unoptimized
            />
            <span
              className={`w-14 shrink-0 text-right text-sm font-bold tabular-nums ${
                favoured ? 'text-victory' : 'text-defeat'
              }`}
            >
              {favoured ? '+' : '−'}
              {Math.abs(m.edge * 100).toFixed(1)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
