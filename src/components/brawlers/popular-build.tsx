import Image from 'next/image';
import Link from 'next/link';

import { GadgetIcon, GearIcon, StarPowerIcon } from '@/components/game-icons';

import { gearIconUrl } from '@/lib/brawlapi';
import { formatNumber, formatPercent } from '@/lib/format';
import type { BAAccessory, BABrawler } from '@/types/brawlapi';
import type { BrawlerBuild, BuildOption } from '@/types/stats';

interface Props {
  build: BrawlerBuild | null;
  /** Artwork and names for this brawler's star powers and gadgets. */
  meta?: BABrawler;
  /** id -> gear name, from the official catalogue. */
  gearNames: Map<number, string>;
}

/**
 * Which gears this brawler's owners spend their coins on.
 *
 * Gears are the part of a loadout that is actually a choice. A player picks
 * two from nineteen and pays for them, so what experienced owners have bought
 * is a revealed preference worth reading: on Shelly the spread runs from 25%
 * down to 7%, and the top of that list is a real recommendation.
 *
 * Star powers and gadgets are not, which is why they are treated differently
 * below. Measured across the sampled pool, between 74% and 99% of a brawler's
 * owners have unlocked *both* options, so the split between them is always
 * near enough to 50/50 to be noise. Presenting that as a build recommendation
 * would be dressing up a coin flip. They are shown only when the two options
 * genuinely diverge, and summarised in a line otherwise.
 *
 * None of this is usage. The API publishes what a player owns on a brawler and
 * nothing about what they took into a match, and there is no field for it
 * anywhere in the player or battle payloads.
 */
export function PopularBuild({ build, meta, gearNames }: Props) {
  if (!build || build.sampleSize === 0) {
    return (
      /* An empty state that ends the visit is a wasted one, so it says what is
         missing and offers a page that does have an answer. */
      <div className="card p-6">
        <p className="text-sm leading-relaxed text-muted">
          No sampled player owns this brawler yet, so there is nothing to measure.
          This fills in over the next few days as the sampler works through profiles.
        </p>
        <Link
          href="/tier-list/trophy"
          className="mt-4 inline-flex rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
        >
          See what is strong right now
        </Link>
      </div>
    );
  }

  const accessoryById = new Map<number, BAAccessory>();
  for (const a of [...(meta?.starPowers ?? []), ...(meta?.gadgets ?? [])]) {
    accessoryById.set(a.id, a);
  }

  /*
   * How far apart the two options have to be before the split says anything.
   *
   * Below this the difference is smaller than the week-to-week wobble in the
   * sample, so the row would be ranking noise.
   */
  const MEANINGFUL_GAP = 0.08;

  const spread = (options: BuildOption[]) =>
    options.length > 1 ? Math.abs(options[0].share - options[1].share) : 0;

  const starPowersSplit = spread(build.starPowers) >= MEANINGFUL_GAP;
  const gadgetsSplit = spread(build.gadgets) >= MEANINGFUL_GAP;

  const groups: {
    title: string;
    node: React.ReactNode;
    options: BuildOption[];
    /** Shown above the bars when the split needs framing. */
    note?: string;
  }[] = [
    {
      title: 'Gears owners buy',
      node: <GearIcon className="size-5" />,
      options: build.gears,
      note: 'Gears cost coins and you can only run two, so what owners have bought is a real preference.',
    },
    ...(starPowersSplit
      ? [
          {
            title: 'Star powers',
            node: <StarPowerIcon className="size-5" />,
            options: build.starPowers,
            note: 'One of these is noticeably more common than the other, which usually means it came first or is the one people buy.',
          },
        ]
      : []),
    ...(gadgetsSplit
      ? [
          {
            title: 'Gadgets',
            node: <GadgetIcon className="size-5" />,
            options: build.gadgets,
            note: undefined,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {groups.map(({ title, node, options, note }) => {
        if (options.length === 0) return null;

        return (
          <div key={title} className="card p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              {node}
              {title}
            </h3>
            {note ? (
              <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">{note}</p>
            ) : (
              <div className="mb-3" />
            )}

            <ul className="space-y-2">
              {options.map((option, index) => {
                // Only crown a favourite when the leader is clearly ahead;
                // a near-even split means players take both.
                const leadMargin =
                  options.length > 1 ? options[0].share - options[1].share : 0;
                const accessory = accessoryById.get(option.itemId);
                const isGear = title.startsWith('Gears');
                const name =
                  accessory?.name ?? gearNames.get(option.itemId) ?? `#${option.itemId}`;
                const imageUrl = accessory?.imageUrl ?? (isGear ? gearIconUrl(option.itemId) : null);

                return (
                  <li key={option.itemId} className="flex items-center gap-3">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt=""
                        width={36}
                        height={36}
                        className="size-9 shrink-0 object-contain"
                        unoptimized
                      />
                    ) : (
                      <span className="size-9 shrink-0 rounded bg-surface-2" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium capitalize">
                          {name.toLowerCase()}
                          {index === 0 && options.length > 1 && leadMargin > 0.1 ? (
                            <span className="ml-2 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand">
                              Most picked
                            </span>
                          ) : null}
                        </span>
                        <span className="flex shrink-0 items-baseline gap-2">
                          <span className="text-xs text-muted">
                            {formatNumber(option.owners)} unlocks
                          </span>
                          <span className="text-sm font-bold tabular-nums">
                            {formatPercent(option.share)}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-strong to-brand"
                          style={{ width: `${Math.round(option.share * 100)}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {/* What the numbers are, in one line. The methodology behind them lives
          on the About page rather than under every chart. */}
      <p className="text-xs leading-relaxed text-muted">
        {`Measured across ${formatNumber(build.sampleSize)} tracked players who own this brawler.${
          !starPowersSplit && !gadgetsSplit
            ? ' Almost all of them own both star powers and both gadgets.'
            : ''
        }`}
      </p>
    </div>
  );
}
