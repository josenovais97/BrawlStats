import Image from 'next/image';

import { GadgetIcon, GearIcon, StarPowerIcon } from '@/components/game-icons';

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

/** Gear artwork follows a stable CDN pattern, keyed by gear id. */
function gearIconUrl(id: number): string {
  return `https://cdn.brawlify.com/gears/regular/${id}.png`;
}

/**
 * The most commonly unlocked star power, gadget and gears among sampled
 * players. The API never reports which option a player has *equipped*, so
 * unlock rates are the available signal — and for gears, where players pick a
 * handful from many, that signal is strong.
 */
export function PopularBuild({ build, meta, gearNames }: Props) {
  if (!build || build.sampleSize === 0) {
    return (
      <p className="card p-6 text-sm text-muted">
        Not enough data collected for this brawler yet.
      </p>
    );
  }

  const accessoryById = new Map<number, BAAccessory>();
  for (const a of [...(meta?.starPowers ?? []), ...(meta?.gadgets ?? [])]) {
    accessoryById.set(a.id, a);
  }

  const groups: {
    title: string;
    node: React.ReactNode;
    options: BuildOption[];
  }[] = [
    {
      title: 'Star power',
      node: <StarPowerIcon className="size-5" />,
      options: build.starPowers,
    },
    { title: 'Gadget', node: <GadgetIcon className="size-5" />, options: build.gadgets },
    { title: 'Gears', node: <GearIcon className="size-5" />, options: build.gears },
  ];

  return (
    <div className="space-y-4">
      {groups.map(({ title, node, options }) => {
        if (options.length === 0) return null;

        return (
          <div key={title} className="card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              {node}
              {title}
            </h3>

            <ul className="space-y-2">
              {options.map((option, index) => {
                // Only crown a favourite when the leader is clearly ahead;
                // a near-even split means players take both.
                const leadMargin =
                  options.length > 1 ? options[0].share - options[1].share : 0;
                const accessory = accessoryById.get(option.itemId);
                const isGear = title === 'Gears';
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

      <p className="text-xs text-muted">
        Split of unlocks within each category, across {formatNumber(build.sampleSize)}{' '}
        tracked players who own this brawler.
      </p>
    </div>
  );
}
