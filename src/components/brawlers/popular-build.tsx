import { Cog, Sparkles, Wrench } from 'lucide-react';
import Image from 'next/image';

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
    icon: typeof Sparkles;
    tone: string;
    options: BuildOption[];
  }[] = [
    { title: 'Star power', icon: Sparkles, tone: 'text-brand', options: build.starPowers },
    { title: 'Gadget', icon: Wrench, tone: 'text-accent', options: build.gadgets },
    { title: 'Gears', icon: Cog, tone: 'text-muted', options: build.gears },
  ];

  return (
    <div className="space-y-4">
      {groups.map(({ title, icon: Icon, tone, options }) => {
        if (options.length === 0) return null;

        return (
          <div key={title} className="card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Icon className={`size-4 ${tone}`} />
              {title}
            </h3>

            <ul className="space-y-2">
              {options.map((option, index) => {
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
                          {index === 0 && !isGear ? (
                            <span className="ml-2 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand">
                              Most picked
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums">
                          {formatPercent(option.share)}
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
        Based on {formatNumber(build.sampleSize)} tracked players who own this brawler.
      </p>
    </div>
  );
}
