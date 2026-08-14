import type { Metadata } from 'next';
import { CalendarClock, Clock, Radio } from 'lucide-react';
import Image from 'next/image';

import { ErrorState } from '@/components/ui/error-state';
import { getGameModeMap, getMapMap } from '@/lib/brawlapi';
import { getEventRotation } from '@/lib/bs-api';
import { toApiError } from '@/lib/errors';
import { humanizeMode, partitionRotation, timeUntil } from '@/lib/format';
import type { BAGameMode, BAMap } from '@/types/brawlapi';
import type { BSRotationSlot } from '@/types/brawlstars';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Current and upcoming Brawl Stars event rotation across every mode slot.',
};

export const revalidate = 120;

export default async function EventsPage() {
  let rotation: BSRotationSlot[];
  try {
    rotation = await getEventRotation();
  } catch (err) {
    return <ErrorState code={toApiError(err).code} title="Event rotation unavailable" />;
  }

  // Cosmetic metadata is optional — the page still works without artwork.
  const [mapMeta, modeMeta] = await Promise.all([
    getMapMap().catch(() => new Map<number, BAMap>()),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
  ]);

  const { active, upcoming } = partitionRotation(rotation);
  active.sort((a, b) => a.slotId - b.slotId);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Events</h1>
        <p className="mt-2 text-muted">
          The live rotation straight from the game API, with map art from BrawlAPI.
        </p>
      </header>

      <EventSection
        title="Live now"
        icon={Radio}
        slots={active}
        mapMeta={mapMeta}
        modeMeta={modeMeta}
        emptyLabel="No active events reported right now."
        showEndsIn
      />

      <EventSection
        title="Upcoming"
        icon={CalendarClock}
        slots={upcoming}
        mapMeta={mapMeta}
        modeMeta={modeMeta}
        emptyLabel="No upcoming events announced yet."
      />
    </div>
  );
}

function EventSection({
  title,
  icon: Icon,
  slots,
  mapMeta,
  modeMeta,
  emptyLabel,
  showEndsIn = false,
}: {
  title: string;
  icon: typeof Radio;
  slots: BSRotationSlot[];
  mapMeta: Map<number, BAMap>;
  modeMeta: Map<string, BAGameMode>;
  emptyLabel: string;
  showEndsIn?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Icon className="size-5 text-brand" />
        {title}
        <span className="text-base font-normal text-muted">({slots.length})</span>
      </h2>

      {slots.length === 0 ? (
        <p className="card p-6 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot) => (
            <EventCard
              key={`${slot.slotId}-${slot.startTime}-${slot.event.id}`}
              slot={slot}
              map={mapMeta.get(slot.event.id)}
              mode={modeMeta.get((slot.event.mode ?? '').toLowerCase())}
              showEndsIn={showEndsIn}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EventCard({
  slot,
  map,
  mode,
  showEndsIn,
}: {
  slot: BSRotationSlot;
  map?: BAMap;
  mode?: BAGameMode;
  showEndsIn: boolean;
}) {
  const accent = mode?.color ?? '#8b95b8';
  const modeLabel = mode?.name ?? humanizeMode(slot.event.mode);

  return (
    <article className="card overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: `color-mix(in srgb, ${accent} 18%, transparent)` }}
      >
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
        <div className="min-w-0">
          <p className="truncate font-bold" style={{ color: accent }}>
            {modeLabel}
          </p>
          <p className="truncate text-xs text-muted">Slot {slot.slotId}</p>
        </div>
      </div>

      {map?.imageUrl ? (
        <Image
          src={map.imageUrl}
          alt={slot.event.map ?? ''}
          width={300}
          height={180}
          className="h-40 w-full bg-surface-2 object-contain p-2"
          unoptimized
        />
      ) : (
        <div className="grid h-40 w-full place-items-center bg-surface-2 text-sm text-muted">
          No map preview
        </div>
      )}

      <div className="p-4">
        <p className="truncate font-semibold">{slot.event.map ?? 'Unknown map'}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <Clock className="size-3.5" />
          {showEndsIn
            ? `Ends in ${timeUntil(slot.endTime)}`
            : `Starts in ${timeUntil(slot.startTime)}`}
        </p>
      </div>
    </article>
  );
}
