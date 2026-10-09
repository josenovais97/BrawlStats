import Image from 'next/image';

import { GadgetIcon, StarPowerIcon } from '@/components/game-icons';
import { gadgetIconUrl, gearIconUrl, starPowerIconUrl } from '@/lib/brawlapi';
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
 * Most *owned*, not most equipped and not most effective — and the difference
 * between the first two is not pedantry. The game API reports what a player
 * has unlocked on a brawler and never what they took into a match; the About
 * page says so directly, and this heading said "Most equipped" anyway, which
 * contradicted it on the one page a reader goes to before spending coins.
 *
 * So it reports the build players have converged on buying, not one this site
 * has judged, and not one anybody has been observed using.
 */
export function RecommendedBuild({
  build,
  meta,
  gearNames,
  variant = 'strip',
}: {
  build: BrawlerBuild | null;
  meta?: { gadgets: NamedAccessory[]; starPowers: NamedAccessory[] };
  gearNames: Map<number, string>;
  /**
   * `hero` draws the build as four icon cards inside the page's header: the
   * answer a "best <name> build" search came for, as a picture in the first
   * screen rather than a line of text under it.
   */
  variant?: 'strip' | 'hero';
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

  if (variant === 'hero') {
    const cards: { key: string; kind: string; name: string; share: number; icon: string }[] = [];
    if (starPower && starPowerName) {
      cards.push({
        key: `sp-${starPower.itemId}`,
        kind: 'Star power',
        name: starPowerName,
        share: starPower.share,
        icon: starPowerIconUrl(starPower.itemId),
      });
    }
    if (gadget && gadgetName) {
      cards.push({
        key: `g-${gadget.itemId}`,
        kind: 'Gadget',
        name: gadgetName,
        share: gadget.share,
        icon: gadgetIconUrl(gadget.itemId),
      });
    }
    for (const gear of gears) {
      const name = gearNames.get(gear.itemId);
      if (name) {
        cards.push({ key: `gr-${gear.itemId}`, kind: 'Gear', name, share: gear.share, icon: gearIconUrl(gear.itemId) });
      }
    }
    return (
      <div>
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <p className="display text-sm uppercase tracking-wide">The build owners run</p>
          <a href="#build" className="text-xs font-semibold text-brand hover:underline">
            Why, and what else
          </a>
        </div>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {cards.map((c) => (
            <li
              key={c.key}
              className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/40 p-2.5 backdrop-blur"
            >
              <Image
                src={c.icon}
                alt=""
                width={44}
                height={44}
                className="size-11 shrink-0 object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]"
                unoptimized
              />
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  {c.kind}
                </span>
                <span className="block truncate text-sm font-bold capitalize leading-tight">
                  {c.name.toLowerCase()}
                </span>
                <span className="block text-xs tabular-nums text-brand">
                  {formatPercent(c.share)} of owners
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="card flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">Most owned</p>

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
