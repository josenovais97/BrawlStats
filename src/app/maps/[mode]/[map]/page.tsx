import type { Metadata } from 'next';
import { ArrowLeft, Swords } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MapPickList } from '@/components/maps/map-pick-list';
import { MapPreview } from '@/components/ranked/map-preview';
import { JsonLd, breadcrumbSchema, faqSchema } from '@/components/seo/structured-data';
import { SectionHeading } from '@/components/ui/section-heading';
import { getBrawlerMap } from '@/lib/brawlapi';
import { formatNumber, formatPercent, minutesSince } from '@/lib/format';
import { getActiveMaps, resolveMap } from '@/lib/game-maps';
import { getMapWiki } from '@/lib/map-wiki';
import { wikiPageUrl } from '@/lib/wiki';
import { slugify } from '@/lib/slugs';
import {
  MAP_ROTATION_GRACE_DAYS,
  RANKED_MAP_WINDOW_DAYS,
  getBestPicksByMode,
  getRankedMapPicks,
} from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';
import type { ModeBestPicks } from '@/types/stats';

interface PageProps {
  params: Promise<{ mode: string; map: string }>;
}

/**
 * Own aggregate plus static artwork. An hour keeps the picks fresh enough
 * without regenerating four hundred pages on every sampler run.
 */
export const revalidate = 3600;

/** How many brawlers a map page ranks. Deeper than the three-up card on /ranked. */
const PICK_COUNT = 10;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { mode, map } = await params;
  const entry = await resolveMap(mode, map).catch(() => undefined);
  if (!entry) return { title: 'Map' };

  const modeLabel = entry.mode?.name ?? entry.map.gameMode.name;

  return {
    // Written as the query, because that is how this page is found: people
    // search the map name plus the thing they want to know about it.
    title: `${entry.map.name} best brawlers, ${modeLabel} map guide`,
    description: `The strongest brawlers on ${entry.map.name} (${modeLabel}) in Brawl Stars, ranked from sampled battles, with the map layout and how much evidence is behind each pick.`,
    alternates: { canonical: `/maps/${entry.modeSlug}/${entry.mapSlug}` },
    openGraph: {
      title: `${entry.map.name} best brawlers`,
      description: `Best Brawl Stars brawlers on ${entry.map.name} (${modeLabel}), from sampled battles.`,
      images: entry.map.imageUrl ? [{ url: entry.map.imageUrl }] : undefined,
    },
  };
}

export default async function MapPage({ params }: PageProps) {
  const { mode: modeSlug, map: mapSlug } = await params;
  const entry = await resolveMap(modeSlug, mapSlug).catch(() => undefined);
  if (!entry) notFound();

  const modeLabel = entry.mode?.name ?? entry.map.gameMode.name;
  const accent = entry.mode?.color ?? '#8b95b8';

  const brawlerMeta = await getBrawlerMap().catch(() => new Map<number, BABrawler>());
  // Layout and environment. The mode is passed so a map name shared across
  // modes cannot pick up the wrong page's description.
  const mapWiki = await getMapWiki(entry.map.name, modeLabel).catch(() => null);

  // Database reads run one after the other so the page never needs more than
  // one connection, and each degrades to empty on its own.
  const mapPicks = entry.scHash
    ? await getRankedMapPicks(PICK_COUNT, RANKED_MAP_WINDOW_DAYS, {
        mapName: entry.map.name,
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
  const inRotation =
    sinceLastSeen !== null && sinceLastSeen < MAP_ROTATION_GRACE_DAYS * 24 * 60;
  const hasMapPicks = inRotation && (mapPicks?.picks.length ?? 0) > 0;
  const siblings = await getActiveMaps()
    .then((all) =>
      all.filter((m) => m.modeSlug === entry.modeSlug && m.mapSlug !== entry.mapSlug),
    )
    .catch(() => []);

  const faq = [
    {
      question: `What are the best brawlers on ${entry.map.name}?`,
      answer: hasMapPicks
        ? `${listOf(mapPicks!.picks.slice(0, 3).map((p) => titleCase(p.brawlerName)))} ${mapPicks!.picks.length === 1 ? 'has the strongest adjusted win rate' : 'have the strongest adjusted win rates'} on ${entry.map.name}, from ${formatNumber(mapPicks!.sampleSize)} sampled Ranked battles on the map.`
        : mapPicks && !inRotation
          ? `${entry.map.name} is not in the current Ranked rotation, so there are no recent competitive battles to rank brawlers on it. The strongest brawlers in ${modeLabel} overall are the best available answer while it is out.`
          : `${entry.map.name} has not been sampled enough yet to rank brawlers on the map itself. The strongest brawlers in ${modeLabel} overall are the best available answer until it fills in.`,
    },
    {
      question: `What game mode is ${entry.map.name}?`,
      answer: `${entry.map.name} is a ${modeLabel} map in Brawl Stars${mapWiki?.environment ? `, set in the ${mapWiki.environment} environment` : ''}.`,
    },
    ...(mapWiki?.layout
      ? [
          {
            question: `How is ${entry.map.name} laid out?`,
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
          { name: entry.map.name, path: `/maps/${entry.modeSlug}/${entry.mapSlug}` },
        ])}
      />
      <JsonLd data={faqSchema(faq)} />

      <Link
        href={`/maps/${entry.modeSlug}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All {modeLabel} maps
      </Link>

      <header className="card card-glow overflow-hidden">
        <span className="block h-1 w-full" style={{ background: accent }} />
        <MapPreview
          imageUrl={entry.map.imageUrl}
          mapName={entry.map.name}
          modeLabel={modeLabel}
          accent={accent}
        />
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/maps/${entry.modeSlug}`}
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
              <span className="rounded-full bg-brand/15 px-3 py-1 text-xs font-bold uppercase text-brand">
                New
              </span>
            ) : null}
          </div>

          <h1 className="display mt-3 text-3xl uppercase sm:text-4xl">
            {entry.map.name}
          </h1>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted">
            The brawlers with the best records on {entry.map.name}, a {modeLabel} map.
            Ranked from battles sampled off the global leaderboard pool, scored against
            the sample-wide average rather than the map&rsquo;s own. So a pick has to
            beat the field, not just the lobby.
          </p>
          {entry.map.credit ? (
            <p className="mt-2 text-xs text-muted">Map by {entry.map.credit}</p>
          ) : null}
        </div>
      </header>

      <section>
        <SectionHeading
          title={hasMapPicks ? 'Best brawlers here' : `Best brawlers in ${modeLabel}`}
          subtitle={
            hasMapPicks
              ? `From ${formatNumber(mapPicks!.sampleSize)} sampled Ranked battles on this map, weighed against each brawler's overall Ranked form.`
              : mapPicks && !inRotation
                ? `${entry.map.name} is not in the current Ranked rotation, so these are ${modeLabel} picks across every map in the mode instead.`
                : `${entry.map.name} has too few sampled battles to rank on its own yet, so these are ${modeLabel} picks across every map in the mode.`
          }
          aside={
            hasMapPicks ? (
              <span className="inline-flex items-center gap-1.5">
                <Swords className="size-3.5" />
                {mapPicks!.brawlersSeen} brawlers seen
              </span>
            ) : null
          }
        />
        <MapPickList
          picks={hasMapPicks ? mapPicks!.picks : (modePicks?.picks ?? [])}
          brawlerMeta={brawlerMeta}
          emptyLabel={`No sampled battles for ${modeLabel} yet. The sampler works through the leaderboard pool continuously, so this fills in over the next day or two.`}
        />

        {hasMapPicks ? (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Scores are shown against a {formatPercent(mapPicks!.baselineWinRate)}{' '}
            sample-wide Ranked average. A brawler with a handful of battles here is
            pulled toward its overall Ranked form, so the map has to produce real
            evidence before it moves anyone.
          </p>
        ) : null}
      </section>

      {mapWiki?.layout ? (
        <section>
          <SectionHeading
            title="Layout"
            subtitle="How the map is built, and what that rewards."
          />
          <div className="card space-y-3 p-5">
            {mapWiki.intro ? (
              <p className="text-sm leading-relaxed text-muted">{mapWiki.intro}</p>
            ) : null}
            <p className="leading-relaxed">{mapWiki.layout}</p>
            <p className="text-xs text-muted">
              Layout description from the{' '}
              <a
                href={wikiPageUrl(mapWiki.title)}
                rel="noreferrer noopener"
                target="_blank"
                className="font-medium text-brand hover:underline"
              >
                Brawl Stars Wiki
              </a>
              , CC-BY-SA. The rankings above are our own.
            </p>
          </div>
        </section>
      ) : null}

      {/* Answers the two questions the page is found by, in the page's own
          copy rather than only in its structured data. */}
      <section>
        <SectionHeading title={`${entry.map.name} FAQ`} />
        <dl className="card divide-y divide-border">
          {faq.map((item) => (
            <div key={item.question} className="p-4">
              <dt className="font-semibold">{item.question}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      {siblings.length > 0 ? (
        <section>
          <SectionHeading
            title={`Other ${modeLabel} maps`}
            aside={
              <Link
                href={
                  entry.scHash
                    ? `/tier-list/ranked/${slugify(entry.scHash)}`
                    : '/tier-list/ranked'
                }
                className="hover:text-foreground"
              >
                {modeLabel} tier list
              </Link>
            }
          />
          <ul className="flex flex-wrap gap-2">
            {siblings.slice(0, 24).map((sibling) => (
              <li key={sibling.map.id}>
                <Link
                  href={`/maps/${sibling.modeSlug}/${sibling.mapSlug}`}
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
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "HARD LANDING" -> "Hard Landing", for prose that quotes an API name. */
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}
