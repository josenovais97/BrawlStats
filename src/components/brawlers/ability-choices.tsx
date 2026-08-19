import Image from 'next/image';

import { GadgetIcon, StarPowerIcon } from '@/components/game-icons';
import { formatNumber, formatPercent } from '@/lib/format';
import type { AbilityChoice, BrawlerAbilityChoices } from '@/lib/stats';
import type { BAAccessory } from '@/types/brawlapi';

/**
 * Which star power and gadget players actually buy first, and how it goes.
 *
 * Read from players who own exactly one of the pair: they chose it, and every
 * battle they played on the brawler was played with it. That makes this a
 * measurement of a decision rather than of ownership, and the win rates beside
 * it a fair comparison, since both groups are equally invested in the brawler.
 *
 * Absent on long-established brawlers, because almost everyone owns both by
 * then and there is no choice left to observe. That is the same moment the
 * question stops being worth asking.
 */
export function AbilityChoices({
  choices,
  starPowers,
  gadgets,
}: {
  choices: BrawlerAbilityChoices;
  starPowers: BAAccessory[];
  gadgets: BAAccessory[];
}) {
  const groups = [
    {
      title: 'Star power',
      node: <StarPowerIcon className="size-5" />,
      rows: choices.starPowers,
      items: starPowers,
    },
    {
      title: 'Gadget',
      node: <GadgetIcon className="size-5" />,
      rows: choices.gadgets,
      items: gadgets,
    },
  ].filter((group) => group.rows.length > 1);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-4">
      {groups.map(({ title, node, rows, items }) => {
        const leader = rows[0];
        const byId = new Map(items.map((item) => [item.id, item]));

        return (
          <div key={title} className="card p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              {node}
              {title} bought first
            </h3>
            <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">
              Among players who own only one so far.
            </p>

            <ul className="space-y-3">
              {rows.map((row) => (
                <Row
                  key={row.itemId}
                  row={row}
                  item={byId.get(row.itemId)}
                  isLeader={row.itemId === leader.itemId && rows.length > 1}
                />
              ))}
            </ul>
          </div>
        );
      })}

      <p className="text-xs leading-relaxed text-muted">
        From {formatNumber(choices.sampleSize)} tracked players who have bought one of
        the pair. Win rates come from their own battles on this brawler, so the two
        sides are equally invested and the gap between them is the ability rather than
        the player. Our sample leans toward high-trophy accounts, so read the two rates
        against each other rather than as absolutes.
      </p>
    </div>
  );
}

function Row({
  row,
  item,
  isLeader,
}: {
  row: AbilityChoice;
  item: BAAccessory | undefined;
  isLeader: boolean;
}) {
  return (
    <li className="flex items-center gap-3">
      {item ? (
        <Image
          src={item.imageUrl}
          alt=""
          width={36}
          height={36}
          className="size-9 shrink-0 object-contain"
          loading="lazy"
          unoptimized
        />
      ) : (
        <span className="size-9 shrink-0 rounded bg-surface-2" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="truncate text-sm font-medium capitalize">
            {(item?.name ?? `#${row.itemId}`).toLowerCase()}
            {isLeader ? (
              <span className="ml-2 rounded bg-brand/15 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase text-brand">
                Most picked
              </span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
            {/* The win rate is the point, so it leads; the share explains how
                many people that rate is based on. */}
            {row.winRate !== null ? (
              <span className="text-sm font-bold text-victory">
                {formatPercent(row.winRate)}
              </span>
            ) : (
              <span className="text-xs text-muted">too few battles</span>
            )}
            <span className="text-xs text-muted">{formatPercent(row.share)} picked</span>
          </span>
        </div>

        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-strong to-brand"
            style={{ width: `${Math.round(row.share * 100)}%` }}
          />
        </div>
      </div>
    </li>
  );
}
