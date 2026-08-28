import Image from 'next/image';

import { GadgetIcon, StarPowerIcon } from '@/components/game-icons';
import { Disclosure } from '@/components/ui/disclosure';
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
 * Shown for every brawler that has enough first-buyers to name a preference,
 * which at a floor of ten is all 106 for star powers and 101 for gadgets. How
 * much weight it carries varies a lot though: on a new brawler the people who
 * own one are a large, live slice of the playerbase, and on an old one they
 * are a handful who never bought the second. The confidence chip carries that
 * difference rather than the section appearing and vanishing between brawlers.
 */
/**
 * Whether there is a preference worth showing at all.
 *
 * Exported so the surrounding layout can decide how many columns it needs
 * without rendering the component to find out — on a long-established brawler
 * nearly every owner has both options, which leaves no first-buyers to
 * measure, and a half-empty two-column row is the visible result.
 */
export function hasAbilityChoices(choices: BrawlerAbilityChoices | null): boolean {
  return (
    choices !== null &&
    (choices.starPowers.length > 1 || choices.gadgets.length > 1)
  );
}

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
  ];

  // Never filtered away: both blocks always render so the page has the same
  // shape on every brawler, and one with too few first-buyers says so instead
  // of silently disappearing.
  if (!hasAbilityChoices(choices)) return null;

  const label = {
    high: 'Well sampled',
    medium: 'Building',
    low: 'Thin sample',
  }[choices.confidence];

  return (
    <div className="space-y-3">
      {groups.map(({ title, node, rows, items }) => {
        const leader = rows[0] as AbilityChoice | undefined;
        const byId = new Map(items.map((item) => [item.id, item]));

        return (
          <div key={title} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                {node}
                {title} bought first
              </h3>
              {/* Quiet at "low", the same treatment the map cards use: a caveat
                  should not be the loudest thing on the card. */}
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
                  choices.confidence === 'low'
                    ? 'bg-surface-2 text-muted'
                    : 'bg-brand/15 text-brand'
                }`}
              >
                {label}
              </span>
            </div>
            <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">
              Among owners who have only one so far.
            </p>

            {rows.length > 1 ? (
              <ul className="space-y-3">
                {rows.map((row) => (
                  <Row
                    key={row.itemId}
                    row={row}
                    item={byId.get(row.itemId)}
                    isLeader={row.itemId === leader!.itemId}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                Almost every owner has both, so there are too few first-buyers left to
                name a preference.
              </p>
            )}
          </div>
        );
      })}

      {/* The methodology is worth keeping and is not worth three paragraphs
          above the numbers it explains. */}
      <Disclosure
        tone="bare"
        summary={`Read from ${formatNumber(choices.sampleSize)} first-buyers`}
      >
        Counted from tracked players who own exactly one of the pair: they chose it,
        and every battle they played on this brawler was played with it. Both sides
        are equally invested in the brawler, so the gap between the two win rates is
        the ability rather than the player &mdash; read them against each other
        rather than as absolutes.
        {choices.confidence === 'low'
          ? ' On a long-established brawler almost everyone owns both, so the few who do not are a small and self-selected group. Treat this as indicative.'
          : ''}
      </Disclosure>
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
              <span className="ml-2 rounded bg-brand/15 px-1.5 py-0.5 text-xs font-bold uppercase text-brand">
                Most picked
              </span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
            {/* The win rate is the point, so it leads; the share explains how
                many people that rate is based on. */}
            {/* Two different measurements, so each says which it is. They
                used to read "too few battles · 68% picked", which put a
                battle-derived number and an ownership-derived one side by side
                with nothing to separate them -- and when the first was missing
                the pair looked like one broken statistic. */}
            {row.winRate !== null ? (
              <span className="text-sm font-bold text-victory">
                {formatPercent(row.winRate)} win rate
              </span>
            ) : null}
            <span className="text-xs text-muted">
              {formatPercent(row.share)} of first buyers &middot; {formatNumber(row.choosers)}{' '}
              {row.choosers === 1 ? 'player' : 'players'}
            </span>
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
