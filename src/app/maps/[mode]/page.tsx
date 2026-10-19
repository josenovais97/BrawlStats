import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MapPickList } from '@/components/maps/map-pick-list';
import { JsonLd, breadcrumbSchema, itemListSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';

import { formatNumber, titleCase } from '@/lib/format';
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

/** The mode's best picks, or null when there is not enough data to rank any. */
async function modePicks(scHash: string | undefined) {
  if (!scHash) return null;
  const found = await getBestPicksByMode(8)
    .then((byMode) => byMode.get(scHash) ?? null)
    .catch(() => null);
  return found && found.picks.length > 0 ? found : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = getT(requestLocale());
  const { mode } = await params;
  const resolved = await resolveMode(mode);
  if (!resolved) return { title: t('Mode') };

  const picks = await modePicks(resolved.scHash);
  return {
    title: t('{label} maps and best brawlers', { label: resolved.label }),
    description: t('Every Brawl Stars {label} map in rotation, plus the brawlers with the best records in the mode, ranked from sampled battles.', { label: resolved.label }),
    alternates: { canonical: `/maps/${resolved.slug}` },
    // A mode we have no battles for is a heading and a list of map names:
    // kept for visitors, but not offered to search (2026-10-19, before the
    // AdSense review), and left out of the sitemap by the same test.
    ...(picks ? {} : { robots: { index: false, follow: true } }),
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
  const picks = await modePicks(resolved.scHash);
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const ranked = picks ? [...picks.picks].sort((a, b) => b.score - a.score) : [];
  const popular = picks ? [...picks.picks].sort((a, b) => b.pickRate - a.pickRate)[0] : null;
  // The API's names are upper case ("EL PRIMO"); the art catalogue has the display form.
  const bn = (pick: { brawlerId: number; brawlerName: string }) =>
    brawlerMeta.get(pick.brawlerId)?.name ?? titleCase(pick.brawlerName);

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

      {/*
        The numbers below, said in words: what a reader would conclude from
        the list, written from this week's data so it changes with the meta.
      */}
      {picks && ranked.length >= 3 ? (
        <section className="card space-y-3 p-5 text-sm leading-relaxed text-muted">
          <h2 className="font-bold text-foreground">{t('{label} this week', { label: resolved.label })}</h2>
          <p>
            {t('{first} has the best record in {label} right now, with a {score} adjusted win rate over {n} decided battles, ahead of {second} and {third}.', {
              first: bn(ranked[0]),
              label: resolved.label,
              score: pct(ranked[0].score),
              n: formatNumber(ranked[0].decidedSampleSize),
              second: bn(ranked[1]),
              third: bn(ranked[2]),
            })}{' '}
            {t('Across every brawler, the mode has {total} sampled battles from the last 7 days on {maps} maps in rotation, and the average brawler wins {base} of them.', {
              total: formatNumber(picks.sampleSize),
              maps: resolved.maps.length,
              base: pct(picks.baselineWinRate),
            })}
          </p>
          {popular && popular.brawlerId !== ranked[0].brawlerId ? (
            <p>
              {t('The most played of these is {name}, in {rate} of battles. Popularity and strength are not the same thing: the order above is by adjusted win rate, which corrects for how often each brawler is picked and for the players picking it.', {
                name: bn(popular),
                rate: pct(popular.pickRate),
              })}
            </p>
          ) : null}
          <p>
            {t('Each map has its own page with the picks for that map alone, which can differ a lot from the mode as a whole: open one below.')}
          </p>
        </section>
      ) : null}

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
