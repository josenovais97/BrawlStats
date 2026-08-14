import { Clock } from 'lucide-react';
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {slots.map((slot) => {
        const map = mapMeta.get(slot.event.id);
        const mode = modeMeta.get((slot.event.mode ?? '').toLowerCase());
        const accent = mode?.color ?? '#8b95b8';

        return (
          <Link
            key={`${slot.slotId}-${slot.event.id}`}
            href="/events"
            className="card card-interactive group overflow-hidden"
          >
            <div className="relative h-32 bg-surface-2">
              {map?.imageUrl ? (
                <Image
                  src={map.imageUrl}
                  alt=""
                  fill
                  className="object-contain p-2"
                  unoptimized
                />
              ) : null}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent"
              />
            </div>

            <div className="flex items-center gap-3 p-4">
              {mode?.imageUrl ? (
                <Image
                  src={mode.imageUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 shrink-0 object-contain"
                  unoptimized
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold" style={{ color: accent }}>
                  {mode?.name ?? humanizeMode(slot.event.mode)}
                </p>
                <p className="truncate text-xs text-muted">
                  {slot.event.map ?? 'Unknown map'}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
                <Clock className="size-3" />
                {timeUntil(slot.endTime)}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
