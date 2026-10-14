import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MapPickList } from '@/components/maps/map-pick-list';
import { JsonLd, breadcrumbSchema, itemListSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';

import { formatNumber } from '@/lib/format';
import { getActiveMaps } from '@/lib/game-maps';
import { slugify } from '@/lib/slugs';
import { getBestPicksByMode } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { mapNamer, modeNamer } from '@/lib/i18n-game';

interface PageProps {
  params: Promise<{ mode: string }>;
}

export const revalidate = 3600;

/* Runtime ISR. See `/brawlers/[slug]` for why the empty array is required. */
export async function generateStaticParams() {
  return [];
}

/** Resolves the mode slug against the modes that actually have active maps. */
async function resolveMode(slug: string) {
  const maps = await getActiveMaps().catch(() => []);
  const wanted = slugify(slug);
  const inMode = maps.filter((entry) => entry.modeSlug === wanted);
  if (inMode.length === 0) return null;

  const first = inMode[0];
  return {
    slug: wanted,
    // In the page's language: every use of the label is display.
    label: (await modeNamer())(first.mode?.name ?? first.map.gameMode.name),
    color: first.mode?.color ?? '#8b95b8',
    imageUrl: first.mode?.imageUrl,
    description: first.mode?.shortDescription ?? first.mode?.description ?? null,
    scHash: first.scHash,
    maps: inMode,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = getT(requestLocale());
  const { mode } = await params;
  const resolved = await resolveMode(mode);
  if (!resolved) return { title: t('Mode') };

  return {
    title: t('{label} maps and best brawlers', { label: resolved.label }),
    description: t('Every Brawl Stars {label} map in rotation, plus the brawlers with the best records in the mode, ranked from sampled battles.', { label: resolved.label }),
    alternates: { canonical: `/maps/${resolved.slug}` },
  };
}

export default async function ModeMapsPage({ params }: PageProps) {
  const nm = await mapNamer();
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const { mode } = await params;
  const resolved = await resolveMode(mode);
  if (!resolved) notFound();

  const brawlerMeta = await getBrawlerArtMap().catch(() => new Map<number, BABrawler>());
  const picks = resolved.scHash
    ? await getBestPicksByMode(8)
        .then((byMode) => byMode.get(resolved.scHash!) ?? null)
        .catch(() => null)
    : null;

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Maps', path: '/maps' },
          { name: resolved.label, path: `/maps/${resolved.slug}` },
        ])}
      />
      <JsonLd
        data={itemListSchema(
          `${resolved.label} maps`,
          `Active Brawl Stars ${resolved.label} maps.`,
          resolved.maps.map((entry) => ({
            name: nm(entry.map.name),
            path: `/maps/${entry.modeSlug}/${entry.mapSlug}`,
          })),
        )}
      />

      <Link
        href={lp('/maps')}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />{t('All maps')}</Link>

      <PageHeading
        title={t(resolved.label)}
        subtitle={
          resolved.description ??
          t('Every {label} map currently in rotation, and the brawlers with the best records in the mode.', { label: resolved.label })
        }
        aside={
          resolved.imageUrl ? (
            <Image
              src={resolved.imageUrl}
              alt=""
              width={56}
              height={56}
              className="size-14 object-contain"
              unoptimized
            />
          ) : null
        }
      />

      {picks && picks.picks.length > 0 ? (
        <section>
          <SectionHeading
            title={t('Best brawlers in {label}', { label: resolved.label })}
            subtitle={t('From {sampleSize} sampled decided battles in this mode, scored against the mode\'s own average.', { sampleSize: formatNumber(picks.sampleSize) })}
          />
          <MapPickList
            picks={picks.picks}
            brawlerMeta={brawlerMeta}
            emptyLabel={t('Not enough sampled battles in this mode yet.')}
          />
        </section>
      ) : null}

      <section>
        <SectionHeading
          title={t('Maps in rotation')}
          aside={`${resolved.maps.length} maps`}
        />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {resolved.maps.map((entry) => (
            <li key={entry.map.id}>
              <Link
                href={lp(`/maps/${entry.modeSlug}/${entry.mapSlug}`)}
                className="card card-interactive block h-full overflow-hidden"
              >
                {entry.map.imageUrl ? (
                  <Image
                    src={entry.map.imageUrl}
                    alt=""
                    width={160}
                    height={100}
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
                    className="h-24 w-full bg-surface-2 object-contain p-1"
                    loading="lazy"
                    unoptimized
                  />
                ) : (
                  <div className="h-24 w-full bg-surface-2" />
                )}
                <span className="block truncate px-3 py-2 text-sm font-semibold">
                  {nm(entry.map.name)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
