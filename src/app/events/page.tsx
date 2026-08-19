import type { Metadata } from 'next';
import { CalendarClock, Clock, Radio } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { ModeBestPicks } from '@/components/events/mode-best-picks';
import { ErrorState } from '@/components/ui/error-state';
import { getBrawlerMap, getGameModeMap, getMapMap } from '@/lib/brawlapi';
import { getEventRotation } from '@/lib/bs-api';
import { toApiError } from '@/lib/errors';
import { humanizeMode, partitionRotation, timeUntil } from '@/lib/format';
import { getActiveMaps } from '@/lib/game-maps';
import { slugify } from '@/lib/slugs';
import { getBestPicksByMode } from '@/lib/stats';
import type { BABrawler, BAGameMode, BAMap } from '@/types/brawlapi';
import type { ModeBestPicks as ModeBestPicksData } from '@/types/stats';
import type { BSRotationSlot } from '@/types/brawlstars';

export const metadata: Metadata = {
  alternates: { canonical: '/events' },
  title: 'Brawl Stars events',
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
  const [mapMeta, modeMeta, brawlerMeta, bestPicks] = await Promise.all([
    getMapMap().catch(() => new Map<number, BAMap>()),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
    getBrawlerMap().catch(() => new Map<number, BABrawler>()),
    // Our own aggregate; an empty map just hides the picks strip.
    getBestPicksByMode(3).catch(() => new Map<string, ModeBestPicksData>()),
  ]);

  const { active, upcoming } = partitionRotation(rotation);
  active.sort((a, b) => a.slotId - b.slotId);

  // Rotation slots carry the map name and mode id; the catalogue turns that
  // pair into a route. A map missing from the catalogue simply loses its link.
  const activeMaps = await getActiveMaps().catch(() => []);
  const mapHrefFor = (slot: BSRotationSlot): string | null => {
    if (!slot.event.map) return null;
    const match = activeMaps.find(
      (entry) =>
        entry.mapSlug === slugify(slot.event.map!) && entry.scHash === slot.event.mode,
    );
    return match ? `/maps/${match.modeSlug}/${match.mapSlug}` : null;
  };

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
        brawlerMeta={brawlerMeta}
        bestPicks={bestPicks}
        emptyLabel="No active events reported right now."
        showEndsIn
        mapHrefFor={mapHrefFor}
      />

      <EventSection
        title="Upcoming"
        icon={CalendarClock}
        slots={upcoming}
        mapMeta={mapMeta}
        modeMeta={modeMeta}
        brawlerMeta={brawlerMeta}
        bestPicks={bestPicks}
        emptyLabel="No upcoming events announced yet."
        mapHrefFor={mapHrefFor}
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
  brawlerMeta,
  bestPicks,
  emptyLabel,
  showEndsIn = false,
  mapHrefFor,
}: {
  title: string;
  icon: typeof Radio;
  slots: BSRotationSlot[];
  mapMeta: Map<number, BAMap>;
  modeMeta: Map<string, BAGameMode>;
  brawlerMeta: Map<number, BABrawler>;
  bestPicks: Map<string, ModeBestPicksData>;
  emptyLabel: string;
  showEndsIn?: boolean;
  /** Resolves a rotation slot to its map page, or null when out of catalogue. */
  mapHrefFor: (slot: BSRotationSlot) => string | null;
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
              brawlerMeta={brawlerMeta}
              picks={bestPicks.get(slot.event.mode ?? '')}
              showEndsIn={showEndsIn}
              mapHref={mapHrefFor(slot)}
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
  brawlerMeta,
  picks,
  showEndsIn,
  mapHref,
}: {
  slot: BSRotationSlot;
  map?: BAMap;
  mode?: BAGameMode;
  brawlerMeta: Map<number, BABrawler>;
  picks?: ModeBestPicksData;
  showEndsIn: boolean;
  mapHref: string | null;
}) {
  const accent = mode?.color ?? '#8b95b8';
  const modeLabel = mode?.name ?? humanizeMode(slot.event.mode);

  return (
    <article className="card flex flex-col overflow-hidden">
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

      <div className="flex-1 p-4">
        {/* The map's own page is where the picks strip below comes from at
            full depth, so the name is the way through to it. */}
        {mapHref ? (
          <Link href={mapHref} className="block truncate font-semibold hover:text-brand">
            {slot.event.map}
          </Link>
        ) : (
          <p className="truncate font-semibold">{slot.event.map ?? 'Unknown map'}</p>
        )}
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <Clock className="size-3.5" />
          {showEndsIn
            ? `Ends in ${timeUntil(slot.endTime)}`
            : `Starts in ${timeUntil(slot.startTime)}`}
        </p>
      </div>

      <ModeBestPicks data={picks} brawlerMeta={brawlerMeta} accent={accent} />
    </article>
  );
}
