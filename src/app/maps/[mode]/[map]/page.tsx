import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BrawlersIcon } from '@/components/game-icons';
import { MapMatchups } from '@/components/maps/map-matchups';
import { MapPickList } from '@/components/maps/map-pick-list';
import { MapPreview } from '@/components/ranked/map-preview';
import { JsonLd, breadcrumbSchema, faqSchema } from '@/components/seo/structured-data';
import { SectionHeading } from '@/components/ui/section-heading';
import { BrawlerPodium } from '@/components/brawlers/brawler-podium';
import { MapTrios } from '@/components/maps/map-trios';
import { currentMonth } from '@/lib/site';

import { formatNumber, formatPercent, minutesSince,
  titleCase,
} from '@/lib/format';
import { getActiveMaps, resolveMap } from '@/lib/game-maps';
import { getMapWiki } from '@/lib/map-wiki';
import { wikiPageUrl } from '@/lib/wiki';
import { slugify } from '@/lib/slugs';
import {
  MAP_ROTATION_GRACE_DAYS,
  RANKED_MAP_WINDOW_DAYS,
  getBestPicksByMode,
  getMapMatchups,
  getRankedMapPicks,
  resolveDataMapName,
} from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';
import type { ModeBestPicks } from '@/types/stats';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { andList } from '@/lib/t';
import { mapNamer, modeNamer } from '@/lib/i18n-game';
import { indexableMaps, mapIndexKey } from '@/lib/map-indexing';

interface PageProps {
  params: Promise<{ mode: string; map: string }>;
}

/*
 * Three hours, matching both the sampler and `READ_CACHE_SECONDS`.
 *
 * Declaring longer achieves nothing: these pages read cached aggregates, and a
 * route's revalidate is the shortest-lived cache inside it. This value was
 * briefly 43200, which the build reported as 1h.
 */
export const revalidate = 7200;

/*
 * Runtime ISR. See `/brawlers/[slug]` for why the empty array is required.
 *
 * This is the route it matters most on: 400-odd URLs, all of them in the
 * sitemap, all of them previously re-rendered against the database on every
 * single crawler hit.
 */
export async function generateStaticParams() {
  return [];
}

/** How many brawlers a map page ranks. Deeper than the three-up card on /ranked. */
const PICK_COUNT = 10;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const nm = await mapNamer();
  const t = getT(requestLocale());
  const { mode, map } = await params;
  const entry = await resolveMap(mode, map).catch(() => undefined);
  if (!entry) return { title: t('Map') };

  // Display name in the page's language; the English one still keys the wiki.
  const modeLabelEn = entry.mode?.name ?? entry.map.gameMode.name;
  const modeLabel = (await modeNamer())(modeLabelEn);
  // Only a map with its own picks is offered to search (lib/map-indexing).
  const indexable = await indexableMaps();
  const ownData =
    !entry.retired && (!indexable || (!!entry.scHash && indexable.has(mapIndexKey(entry.scHash, entry.map.name))));

  return {
    ...(ownData ? {} : { robots: { index: false, follow: true } }),
    // Written as the query, because that is how this page is found: people
    // search the map name plus the thing they want to know about it.
    //
    // A retired map drops the month. The date is a freshness claim, and there
    // is nothing fresh to claim about a map that no longer exists — the page
    // stays useful, but as a record rather than as this month's answer.
    title: entry.retired
      ? t('{name} ({modeLabel}) — retired Brawl Stars map', { name: nm(entry.map.name), modeLabel: modeLabel })
      : t('{name} best brawlers, {modeLabel} ({v})', { name: nm(entry.map.name), modeLabel: modeLabel, v: currentMonth() }),
    description: entry.retired
      ? t('{name} was a {modeLabel} map in Brawl Stars and has since been retired. The map layout, its environment, and the brawlers that perform best in {modeLabel2} generally.', { name: nm(entry.map.name), modeLabel: modeLabel, modeLabel2: modeLabel })
      : t('The strongest brawlers on {name} ({modeLabel}) in Brawl Stars, ranked from sampled battles, with the map layout and how much evidence is behind each pick.', { name: nm(entry.map.name), modeLabel: modeLabel }),
    alternates: { canonical: `/maps/${entry.modeSlug}/${entry.mapSlug}` },
    openGraph: {
      title: t('{name} best brawlers', { name: nm(entry.map.name) }),
      description: t('Best Brawl Stars brawlers on {name} ({modeLabel}), from sampled battles.', { name: nm(entry.map.name), modeLabel: modeLabel }),
      images: entry.map.imageUrl ? [{ url: entry.map.imageUrl }] : undefined,
    },
  };
}

export default async function MapPage({ params }: PageProps) {
  const nm = await mapNamer();
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const { mode: modeSlug, map: mapSlug } = await params;
  const entry = await resolveMap(modeSlug, mapSlug).catch(() => undefined);
  if (!entry) notFound();

  // Display name in the page's language; the English one still keys the wiki.
  const modeLabelEn = entry.mode?.name ?? entry.map.gameMode.name;
  const modeLabel = (await modeNamer())(modeLabelEn);
  const accent = entry.mode?.color ?? '#8b95b8';

  const brawlerMeta = await getBrawlerArtMap().catch(() => new Map<number, BABrawler>());
  // The battle data's spelling of this map, which can differ from the
  // catalogue's in punctuation ("Belle's Rock" / "Belles Rock").
  const dataMapName = entry.scHash
    ? await resolveDataMapName(entry.scHash, entry.map.name).catch(() => entry.map.name)
    : entry.map.name;
  // One cached pass covers every map; this picks its own out of it.
  const matchups = await getMapMatchups()
    .then((byMap) => byMap.get(dataMapName) ?? byMap.get(entry.map.name) ?? [])
    .catch(() => []);
  // Layout and environment. The mode is passed so a map name shared across
  // modes cannot pick up the wrong page's description.
  const mapWiki = await getMapWiki(entry.map.name, modeLabelEn).catch(() => null);

  // Database reads run one after the other so the page never needs more than
  // one connection, and each degrades to empty on its own.
  const mapPicks = entry.scHash
    ? await getRankedMapPicks(PICK_COUNT, RANKED_MAP_WINDOW_DAYS, {
        mapName: dataMapName,
        mode: entry.scHash,
      }).then((rows) => rows[0] ?? null)
    : null;

  // The fallback, and the reason a brand-new map is still worth a page: the
  // mode's own picks are a weaker answer than the map's, but they are a real
  // one, and every map page can offer them.
  const modePicks: ModeBestPicks | null = entry.scHash
    ? await getBestPicksByMode(PICK_COUNT)
        .then((byMode) => byMode.get(entry.scHash!) ?? null)
        .catch(() => null)
    : null;

  // A map can be inside the sampling window without being in the current
  // Ranked season's pool. Its old numbers are real but describe a map nobody
  // can queue for, so the page says that rather than ranking on them.
  const sinceLastSeen = minutesSince(mapPicks?.lastSeen);
  // A retired map is never "in rotation", even for the few days its last
  // battles stay inside the grace window. Without this a map disabled
  // yesterday would carry a Retired badge and a live per-map ranking at the
  // same time, and one of the two would be lying.
  const inRotation =
    !entry.retired &&
    sinceLastSeen !== null &&
    sinceLastSeen < MAP_ROTATION_GRACE_DAYS * 24 * 60;
  const hasMapPicks = inRotation && (mapPicks?.picks.length ?? 0) > 0;
  const siblings = await getActiveMaps()
    .then((all) =>
      all.filter((m) => m.modeSlug === entry.modeSlug && m.mapSlug !== entry.mapSlug),
    )
    .catch(() => []);

  const faq = [
    {
      question: t('What are the best brawlers on {name}?', { name: nm(entry.map.name) }),
      answer: entry.retired
        ? t('{name} has been retired from Brawl Stars and can no longer be played, so there are no current battles to rank brawlers on it. The strongest brawlers in {modeLabel} overall are the closest answer.', { name: nm(entry.map.name), modeLabel: modeLabel })
        : hasMapPicks
        ? t(
            mapPicks!.picks.length === 1
              ? '{v} has the strongest adjusted win rate on {name}, from {sampleSize} sampled Ranked battles on the map.'
              : '{v} have the strongest adjusted win rates on {name}, from {sampleSize} sampled Ranked battles on the map.',
            { v: listOf(mapPicks!.picks.slice(0, 3).map((p) => titleCase(p.brawlerName))), name: nm(entry.map.name), sampleSize: formatNumber(mapPicks!.sampleSize) },
          )
        : mapPicks && !inRotation
          ? t('{name} is not in the current Ranked rotation, so there are no recent competitive battles to rank brawlers on it. The strongest brawlers in {modeLabel} overall are the best available answer while it is out.', { name: nm(entry.map.name), modeLabel: modeLabel })
          : t('{name} has not been sampled enough yet to rank brawlers on the map itself. The strongest brawlers in {modeLabel} overall are the best available answer until it fills in.', { name: nm(entry.map.name), modeLabel: modeLabel }),
    },
    {
      question: t('What game mode is {name}?', { name: nm(entry.map.name) }),
      answer: t(
        entry.retired
          ? '{name} was a {modeLabel} map in Brawl Stars{environment}, and has since been retired.'
          : '{name} is a {modeLabel} map in Brawl Stars{environment}.',
        {
          name: nm(entry.map.name),
          modeLabel,
          environment: mapWiki?.environment ? t(', set in the {environment} environment', { environment: mapWiki.environment }) : '',
        },
      ),
    },
    ...(mapWiki?.layout
      ? [
          {
            question: t('How is {name} laid out?', { name: nm(entry.map.name) }),
            answer: mapWiki.layout,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Maps', path: '/maps' },
          { name: modeLabel, path: `/maps/${entry.modeSlug}` },
          { name: nm(entry.map.name), path: `/maps/${entry.modeSlug}/${entry.mapSlug}` },
        ])}
      />
      <JsonLd data={faqSchema(faq)} />

      <Link
        href={lp(`/maps/${entry.modeSlug}`)}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />{t('All {modeLabel} maps', { modeLabel: modeLabel })}</Link>

      <header className="card card-glow overflow-hidden">
        <span className="block h-1 w-full" style={{ background: accent }} />
        <MapPreview
          imageUrl={entry.map.imageUrl}
          mapName={nm(entry.map.name)}
          modeLabel={modeLabel}
          accent={accent}
        />
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={lp(`/maps/${entry.modeSlug}`)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide transition-opacity hover:opacity-80"
              style={{
                background: `color-mix(in srgb, ${accent} 20%, transparent)`,
                color: accent,
              }}
            >
              {entry.mode?.imageUrl ? (
                <Image
                  src={entry.mode.imageUrl}
                  alt=""
                  width={16}
                  height={16}
                  className="size-4 object-contain"
                  unoptimized
                />
              ) : null}
              {modeLabel}
            </Link>
            {/* The artwork mirror stores an internal asset id here
                ("Katanakingdomnn2"), which is why this chip was dropped
                before; the wiki has the name the game actually shows. */}
            {mapWiki?.environment ? (
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
                {mapWiki.environment}
              </span>
            ) : null}
            {entry.map.new ? (
              <span className="rounded-full bg-brand/15 px-3 py-1 text-xs font-bold uppercase text-brand">{t('New')}</span>
            ) : null}
            {/* Stated up front rather than left for the reader to infer from
                stale numbers further down. */}
            {entry.retired ? (
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold uppercase text-muted">{t('Retired')}</span>
            ) : null}
          </div>

          <h1 className="display mt-3 text-3xl uppercase sm:text-4xl">
            {nm(entry.map.name)}
          </h1>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted">
            {entry.retired ? (
              <>{t('{name} was a {modeLabel} map and has been retired from Brawl Stars, so it can no longer be played. Its layout and environment are below, along with the brawlers that perform best in {modeLabel2} as a whole — the closest thing to a ranking now that the map itself sees no battles.', { name: nm(entry.map.name), modeLabel: modeLabel, modeLabel2: modeLabel })}</>
            ) : (
              <>{t('The brawlers with the best records on {name}, a {mode} map. Ranked from battles sampled off the global leaderboard pool, scored against the sample-wide average rather than the map’s own. So a pick has to beat the field, not just the lobby.', { name: nm(entry.map.name), mode: modeLabel })}</>
            )}
          </p>
          {entry.map.credit ? (
            <p className="mt-2 text-xs text-muted">{t('Map by')}{' '}{entry.map.credit}</p>
          ) : null}
        </div>
      </header>

      <section>
        <SectionHeading
          title={hasMapPicks ? t('Best brawlers here') : t('Best brawlers in {modeLabel}', { modeLabel: modeLabel })}
          subtitle={
            hasMapPicks
              ? t('From {sampleSize} sampled Ranked battles on this map, weighed against each brawler\'s overall Ranked form.', { sampleSize: formatNumber(mapPicks!.sampleSize) })
              : entry.retired
                ? t('{name} has been retired from Brawl Stars, so these are {modeLabel} picks across every map in the mode instead.', { name: nm(entry.map.name), modeLabel: modeLabel })
                : mapPicks && !inRotation
                ? t('{name} is not in the current Ranked rotation, so these are {modeLabel} picks across every map in the mode instead.', { name: nm(entry.map.name), modeLabel: modeLabel })
                : t('{name} has too few sampled battles to rank on its own yet, so these are {modeLabel} picks across every map in the mode.', { name: nm(entry.map.name), modeLabel: modeLabel })
          }
          aside={
            hasMapPicks ? (
              <span className="inline-flex items-center gap-1.5">
                <BrawlersIcon className="size-4" />{t('{brawlersSeen} brawlers seen', { brawlersSeen: mapPicks!.brawlersSeen })}</span>
            ) : null
          }
        />
        {/* The top three as a picture before the list; same component as the
            tier lists. Only for the map's own ranking, where the order is the
            map's -- the mode fallback is a weaker answer and keeps the list. */}
        {hasMapPicks ? (
          <BrawlerPodium
            label={t('Top three on {name}', { name: nm(entry.map.name) })}
            brawlerMeta={brawlerMeta}
            items={mapPicks!.picks.slice(0, 3).map((p) => ({
              brawlerId: p.brawlerId,
              brawlerName: p.brawlerName,
              headline: formatPercent(p.score),
              detail: t('{v}{v2} vs usual', { v: p.score - p.overallScore >= 0 ? '+' : '−', v2: Math.abs((p.score - p.overallScore) * 100).toFixed(1) }),
            }))}
          />
        ) : null}
        <div className={hasMapPicks ? 'mt-4' : ''}>
        <MapPickList
          picks={hasMapPicks ? mapPicks!.picks : (modePicks?.picks ?? [])}
          brawlerMeta={brawlerMeta}
          emptyLabel={t('No sampled battles for {modeLabel} yet. The sampler works through the leaderboard pool continuously, so this fills in over the next day or two.', { modeLabel: modeLabel })}
        />
        </div>

        {hasMapPicks ? (
          <p className="mt-3 text-xs leading-relaxed text-muted">{t('Scores are shown against a')}{' '}{formatPercent(mapPicks!.baselineWinRate)}{' '}{t('sample-wide Ranked average. A brawler with a handful of battles here is pulled toward its overall Ranked form, so the map has to produce real evidence before it moves anyone.')}</p>
        ) : null}
      </section>

      {entry.scHash ? (
        <MapTrios
          mode={entry.scHash}
          mapName={nm(entry.map.name)}
          dataMapName={dataMapName}
          modeLabel={modeLabel}
          brawlerMeta={brawlerMeta}
        />
      ) : null}

      {matchups.length > 0 ? (
        <section>
          <SectionHeading
            title={t('Matchups on this map')}
            subtitle={t('Where a brawler does measurably better or worse against a specific opponent here than it does on {name} generally.', { name: nm(entry.map.name) })}
          />
          <MapMatchups matchups={matchups} brawlerMeta={brawlerMeta} />
          <p className="mt-3 text-xs leading-relaxed text-muted">{t('Each row is measured against that brawler’s own record on this map, so a map that simply favours a brawler does not make all of its matchups look winning. Only matchups with at least 40 sampled battles appear.')}</p>
        </section>
      ) : null}

      {mapWiki?.layout ? (
        <section>
          <SectionHeading
            title={t('Layout')}
            subtitle={t('How the map is built, and what that rewards.')}
          />
          <div className="card space-y-3 p-5">
            {mapWiki.intro ? (
              <p className="text-sm leading-relaxed text-muted">{mapWiki.intro}</p>
            ) : null}
            <p className="leading-relaxed">{mapWiki.layout}</p>
            <p className="text-xs text-muted">{t('Layout description from the')}{' '}
              <a
                href={lp(wikiPageUrl(mapWiki.title))}
                rel="noreferrer noopener"
                target="_blank"
                className="font-medium text-brand hover:underline"
              >{t('Brawl Stars Wiki')}</a>{t(', CC-BY-SA. The rankings above are our own.')}</p>
          </div>
        </section>
      ) : null}

      {/* Answers the two questions the page is found by, in the page's own
          copy rather than only in its structured data. */}
      <section>
        <SectionHeading title={t('{name} FAQ', { name: nm(entry.map.name) })} />
        <dl className="card divide-y divide-border">
          {faq.map((item) => (
            <div key={item.question} className="p-4">
              <dt className="font-semibold">{t(item.question)}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{t(item.answer)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {siblings.length > 0 ? (
        <section>
          <SectionHeading
            title={t('Other {modeLabel} maps', { modeLabel: modeLabel })}
            aside={
              <Link
                href={
                  lp(entry.scHash
                    ? `/tier-list/ranked/${slugify(entry.scHash)}`
                    : '/tier-list/ranked')
                }
                className="hover:text-foreground"
              >{t('{modeLabel} tier list', { modeLabel: modeLabel })}</Link>
            }
          />
          <ul className="flex flex-wrap gap-2">
            {siblings.slice(0, 24).map((sibling) => (
              <li key={sibling.map.id}>
                <Link
                  href={lp(`/maps/${sibling.modeSlug}/${sibling.mapSlug}`)}
                  className="card card-interactive block px-3 py-2 text-sm font-medium"
                >
                  {sibling.map.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** ["A", "B", "C"] -> "A, B and C". */
function listOf(items: string[]): string {
  return andList(items);
}

