import type { Metadata } from 'next';
import { Suspense } from 'react';

import { FavoritesList } from '@/components/favorites-list';
import { HomeCoverage } from '@/components/home/home-coverage';
import { HomeCta } from '@/components/home/home-cta';
import { HomeHero } from '@/components/home/home-hero';
import { HomeLatestVideo } from '@/components/home/home-latest-video';
import { HomeLiveEvents } from '@/components/home/home-live-events';
import { HomeAccountPreview } from '@/components/home/home-account-preview';
import { HomeBand } from '@/components/home/home-band';
import { HomeSection } from '@/components/home/home-section';
import { HomeSnapshot } from '@/components/home/home-snapshot';
import { HomeSplit } from '@/components/home/home-split';
import { HomeTools } from '@/components/home/home-tools';
import { Skeleton } from '@/components/ui/skeletons';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'BrawlZone: Brawl Stars stats, tier lists and leaderboards',
  description:
    'Look up any Brawl Stars player by tag for a skill score out of 10, their roster read against the meta and trophy history over time. Separate Ranked and trophy tier lists, a Ranked elo leaderboard the game API does not publish, and the live event rotation.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'BrawlZone: Brawl Stars stats, tier lists and leaderboards',
    description:
      'Skill scores, separate Ranked and trophy tier lists, a Ranked elo leaderboard, live events and player stats. All from one tag.',
  },
};

/*
 * Ten minutes, and the constant below has to match.
 *
 * The homepage declared no revalidate at all, which does not mean "never
 * revalidate" — it means the route inherits the shortest-lived fetch inside
 * it, and `getEventRotation()` defaults to 120s. So the busiest URL on the
 * site was rebuilding every two minutes: ~21,600 ISR writes and 0.6 GB of
 * origin transfer a month for one page, which is 7% of the whole site's
 * ceiling. `/maps` carries a comment about being caught by exactly this.
 *
 * Ten minutes rather than longer because the two genuinely live things here —
 * the event rotation and the global top three — are the only reason this page
 * is not simply static. It matches what `/events` shows. Everything else on
 * the page reads the 1-hour data cache and never wanted two minutes.
 */
export const revalidate = 600;

/**
 * Must match `revalidate` above, and must be passed to every component that
 * fetches something timed. Both `getEventRotation` and `getPlayerRankings`
 * default to 120s, and either one left at its default silently sets the whole
 * route — which is how this page came to rebuild every two minutes.
 */
const LIVE_REVALIDATE = 600;

/**
 * Structured data for the search box, so the site can surface a search action
 * directly in results. The target has to be an absolute URL template.
 */
const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  /*
   * The spellings people actually type.
   *
   * Google treats `alternateName` as one of its signals for learning a site's
   * name, and "brawl zone" as two words is ambiguous to it: the query already
   * resolves to Brawl Stars' Hot Zone mode, an older Android game, a Bakugan
   * product and several social accounts, all with years of history behind
   * them. Declaring both spellings will not win that query on its own — that
   * takes external mentions and time — but it is what tells Google the two
   * refer to one site.
   */
  alternateName: ['Brawl Zone', 'BrawlZone.net'],
  url: SITE_URL,
  description:
    'Brawl Stars player and club statistics, brawler win rates, live event rotation and global leaderboards.',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/player/{search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

/*
 * Order is the whole design here.
 *
 * Search first, then anything the visitor already has (saved profiles), then
 * live data, then the tools, then the pitch. The page used to run the pitch
 * before the product: two full sections of prose sat between the hero and the
 * first real number, so the things that prove the site works were the things
 * you had to scroll past marketing to reach.
 *
 * Nothing was added to fix that. The six "why BrawlZone" cards became a
 * six-cell toolbar and the four prose cards became four lines beside a link to
 * a real profile, which is why the page is shorter than it was despite showing
 * the same content.
 */
export default function HomePage() {
  return (
    <div className="space-y-14 sm:space-y-20">
      <script
        type="application/ld+json"
        // Static object, no user input, so there is nothing to escape here.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA) }}
      />

      <HomeHero
        stats={
          <Suspense fallback={<Skeleton className="h-[7.5rem] rounded-2xl" />}>
            <HomeCoverage />
          </Suspense>
        }
      />

      {/* Renders nothing until the visitor has saved someone, so a first-time
          view goes straight from the search box to the product. */}
      <FavoritesList />

      {/*
        The claim that separates this site from every other one, moved up here
        on 2026-08-28.

        It used to sit last, on the argument that it was the footnote the
        snapshot earns. That reasoning holds for a reader who arrives at it —
        the problem is that most never did. It was the eighth section, four
        screens down, so the one thing a competitor cannot copy was the one
        thing a bouncing visitor never saw, and everything above it (search, a
        profile, live events, a tier list) is something the other sites also
        have. Stating the difference before the evidence costs a little rigour
        and is the only way it gets read at all.

        It carries its own deep band — see `HomeSplit`.
      */}
      <Suspense fallback={null}>
        <HomeSplit />
      </Suspense>

      {/*
        Then the flagship: the search box above feeds it directly.

        Live events used to hold this slot, which meant the first thing the
        page demonstrated was a rotation anyone can see in the game. What a
        visitor cannot see anywhere else is what BrawlZone does with their tag,
        so that goes first now.
      */}
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <HomeAccountPreview />
      </Suspense>

      <HomeSection
        id="live-now"
        eyebrow={
          <span className="inline-flex items-center gap-2 text-victory">
            <span className="live-dot" />
            In rotation now
          </span>
        }
        title="Live Brawl Stars events"
        subtitle="The maps everyone is playing this slot, straight from the game API."
        ctaHref="/events"
        ctaLabel="View all events"
      >
        <Suspense
          fallback={
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          }
        >
          <HomeLiveEvents revalidate={LIVE_REVALIDATE} />
        </Suspense>
      </HomeSection>

      {/* The first of two changes of ground: this one raised, under the tools.
          The other sinks, under the argument near the foot of the page. Two is
          the limit — a third and the rhythm becomes the decoration. */}
      <HomeBand>
        <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
          <HomeTools />
        </Suspense>
      </HomeBand>

      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <HomeSnapshot revalidate={LIVE_REVALIDATE} />
      </Suspense>

      {/* Under the snapshot on purpose: someone who has just read the numbers
          is the one person on the page who might want them talked through.
          Renders nothing while the channel has no videos. */}
      <Suspense fallback={null}>
        <HomeLatestVideo />
      </Suspense>

      <HomeCta />
    </div>
  );
}
