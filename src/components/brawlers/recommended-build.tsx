import Image from 'next/image';

import { GadgetIcon, StarPowerIcon } from '@/components/game-icons';
import { gearIconUrl } from '@/lib/brawlapi';
import { formatPercent } from '@/lib/format';
import type { BrawlerBuild, BuildOption } from '@/types/stats';

/** Only what naming a pick needs, so either brawler type satisfies it. */
interface NamedAccessory {
  id: number;
  name: string;
}

/**
 * The answer the page title promises, above the fold.
 *
 * Someone arriving from a search for "best Piper build" wants four words, not
 * a biography and a stat grid. Those still follow — this is a summary of the
 * detail below, not a replacement for it, and every number it shows is
 * repeated there with its sample size and its caveats.
 *
 * Most-equipped, not most-effective: these are shares of sampled owners, so
 * this reports the build players converge on rather than one this site has
 * judged. Saying "most equipped" rather than "best" is the difference between
 * describing the data and overclaiming it.
 */
export function RecommendedBuild({
  build,
  meta,
  gearNames,
}: {
  build: BrawlerBuild | null;
  meta?: { gadgets: NamedAccessory[]; starPowers: NamedAccessory[] };
  gearNames: Map<number, string>;
}) {
  if (!build || build.sampleSize === 0) return null;

  const top = (options: BuildOption[]): BuildOption | null =>
    options.length > 0 ? options[0] : null;

  const gadget = top(build.gadgets);
  const starPower = top(build.starPowers);
  const gears = build.gears.slice(0, 2);

  if (!gadget && !starPower && gears.length === 0) return null;

  const nameOf = (list: NamedAccessory[] | undefined, id: number) =>
    list?.find((entry) => entry.id === id)?.name ?? null;

  const gadgetName = gadget ? nameOf(meta?.gadgets, gadget.itemId) : null;
  const starPowerName = starPower ? nameOf(meta?.starPowers, starPower.itemId) : null;

  return (
    <div className="card flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">Most equipped</p>

      {starPower && starPowerName ? (
        <Pick
          icon={<StarPowerIcon className="size-5 shrink-0" />}
          name={starPowerName}
          share={starPower.share}
        />
      ) : null}

      {gadget && gadgetName ? (
        <Pick
          icon={<GadgetIcon className="size-5 shrink-0" />}
          name={gadgetName}
          share={gadget.share}
        />
      ) : null}

      {gears.map((gear) => {
        const name = gearNames.get(gear.itemId);
        if (!name) return null;
        return (
          <Pick
            key={gear.itemId}
            icon={
              <Image
                src={gearIconUrl(gear.itemId)}
                alt=""
                width={20}
                height={20}
                className="size-5 shrink-0"
                unoptimized
              />
            }
            name={name}
            share={gear.share}
          />
        );
      })}

      <a
        href="#build"
        className="ml-auto text-xs font-semibold text-brand transition-colors hover:underline"
      >
        Why, and what else
      </a>
    </div>
  );
}

function Pick({
  icon,
  name,
  share,
}: {
  icon: React.ReactNode;
  name: string;
  share: number;
}) {
  return (
    <span className="flex items-center gap-2">
      {icon}
      <span className="text-sm font-semibold capitalize">{name.toLowerCase()}</span>
      <span className="text-xs tabular-nums text-muted">{formatPercent(share)}</span>
    </span>
  );
}
