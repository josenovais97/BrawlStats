import { ClockIcon } from '@/components/game-icons';
import Image from 'next/image';
import Link from 'next/link';

import { getGameModeMap, getMapMap } from '@/lib/brawlapi';
import { getEventRotation } from '@/lib/bs-api';
import { humanizeMode, partitionRotation, timeUntil } from '@/lib/format';
import type { BAGameMode, BAMap } from '@/types/brawlapi';

/** Three live maps as a homepage teaser. Silent if the rotation is unavailable. */
export async function HomeLiveEvents() {
  let rotation;
  try {
    rotation = await getEventRotation();
  } catch {
    return null;
  }

  const [mapMeta, modeMeta] = await Promise.all([
    getMapMap().catch(() => new Map<number, BAMap>()),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
  ]);

  const { active } = partitionRotation(rotation);
  const slots = active.sort((a, b) => a.slotId - b.slotId).slice(0, 3);
  if (slots.length === 0) return null;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
      {slots.map((slot) => {
        const map = mapMeta.get(slot.event.id);
        const mode = modeMeta.get((slot.event.mode ?? '').toLowerCase());
        const accent = mode?.color ?? '#8b95b8';
        const modeName = mode?.name ?? humanizeMode(slot.event.mode);

        return (
          <li key={`${slot.slotId}-${slot.event.id}`}>
            {/*
              Two shapes from one set of elements: a wide row on a phone, where
              a poster card would burn most of the screen on empty margin round
              a small map thumbnail, and a poster card from `sm` up.
            */}
            <Link
              href="/events"
              className="card card-interactive group flex h-full overflow-hidden sm:flex-col"
            >
              {/*
                The mode colour is the only tint on the card: a bar down the
                leading edge plus a wash under the map art. That is enough to
                tell Gem Grab from Brawl Ball at a glance without colouring in
                the whole tile.
              */}
              <span
                aria-hidden
                className="w-1 shrink-0 sm:h-1 sm:w-full"
                style={{ background: accent }}
              />

              <div className="relative w-24 shrink-0 self-stretch overflow-hidden bg-surface-2 sm:h-32 sm:w-full">
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(18rem 9rem at 50% 115%, color-mix(in srgb, ${accent} 32%, transparent), transparent 70%)`,
                  }}
                />

                {map?.imageUrl ? (
                  <Image
                    src={map.imageUrl}
                    alt={`${slot.event.map ?? modeName} map layout`}
                    fill
                    sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 6rem"
                    /*
                     * Cover, not contain. Brawl Stars maps are tall portraits;
                     * fitting one whole into a landscape frame leaves the card
                     * mostly empty, and the full layout belongs on the events
                     * page anyway. Here the art is a texture, not a diagram.
                     */
                    className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.04]"
                    loading="lazy"
                    unoptimized
                  />
                ) : null}

                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 hidden h-14 bg-gradient-to-t from-surface to-transparent sm:block"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-3.5 sm:gap-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-victory/25 bg-victory/10 px-2 py-1">
                    <span className="live-dot" />
                    <span className="eyebrow text-victory">Live</span>
                  </span>
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold tabular-nums text-muted">
                    <ClockIcon className="size-4" />
                    {timeUntil(slot.endTime)}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {mode?.imageUrl ? (
                    <Image
                      src={mode.imageUrl}
                      alt=""
                      width={36}
                      height={36}
                      className="size-8 shrink-0 object-contain sm:size-9"
                      loading="lazy"
                      unoptimized
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-xs font-bold uppercase tracking-[0.14em]"
                      style={{ color: accent }}
                    >
                      {modeName}
                    </p>
                    <p className="display mt-1 truncate text-base leading-none">
                      {slot.event.map ?? 'Unknown map'}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
