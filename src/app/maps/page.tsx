import type { Metadata } from 'next';
import { Map as MapIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { getActiveMaps, groupByMode } from '@/lib/game-maps';

export const metadata: Metadata = {
  title: 'Brawl Stars maps — best brawlers for every map',
  description:
    'Every active Brawl Stars map, grouped by game mode, with the strongest brawlers on each one ranked from sampled battles.',
  alternates: { canonical: '/maps' },
};

/** Artwork only; the per-map numbers live on the map pages themselves. */
export const revalidate = 86400;

export default async function MapsIndexPage() {
  const maps = await getActiveMaps().catch(() => []);
  const groups = groupByMode(maps);

  return (
    <div className="space-y-10">
      <JsonLd data={breadcrumbSchema([{ name: 'Maps', path: '/maps' }])} />

      <PageHeading
        title="Maps"
        subtitle={`Every map currently in rotation, grouped by mode. Each one ranks the brawlers with the best records on it, from sampled battles.`}
        aside={
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <MapIcon className="size-4" />
            {maps.length} active maps
          </span>
        }
      />

      {groups.length === 0 ? (
        <p className="card p-6 text-sm text-muted">
          The map catalogue is unavailable right now.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.mode} aria-labelledby={`mode-${group.mode}`}>
            <div id={`mode-${group.mode}`}>
              <SectionHeading
                title={group.label}
                aside={
                  <Link
                    href={`/maps/${group.mode}`}
                    className="font-medium hover:text-foreground"
                  >
                    {group.maps.length} maps
                  </Link>
                }
              />
            </div>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.maps.map((entry) => (
                <li key={entry.map.id}>
                  <Link
                    href={`/maps/${entry.modeSlug}/${entry.mapSlug}`}
                    className="card card-interactive block h-full overflow-hidden"
                  >
                    {entry.map.imageUrl ? (
                      <Image
                        src={entry.map.imageUrl}
                        alt=""
                        width={160}
                        height={100}
                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
                        className="h-24 w-full object-contain bg-surface-2 p-1"
                        loading="lazy"
                        unoptimized
                      />
                    ) : (
                      <div className="h-24 w-full bg-surface-2" />
                    )}
                    <span className="block truncate px-3 py-2 text-sm font-semibold">
                      {entry.map.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
