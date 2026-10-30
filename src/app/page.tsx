import type { Metadata } from 'next';
import { Suspense } from 'react';

import { FavoritesList } from '@/components/favorites-list';
import { HomeBand } from '@/components/home/home-band';
import { HomeBubble } from '@/components/home/home-bubble';
import { HomeHero } from '@/components/home/home-hero';
import { HomeLiveEvents } from '@/components/home/home-live-events';
import { HomeLobby } from '@/components/home/home-lobby';
import { HomeMetaNow } from '@/components/home/home-meta-now';
import { HomePlayTest } from '@/components/home/home-play-test';
import { HomeProof } from '@/components/home/home-proof';
import { HomeRadarSection } from '@/components/home/home-radar-section';
import { HomeSection } from '@/components/home/home-section';
import { HomeTools } from '@/components/home/home-tools';
import { Skeleton } from '@/components/ui/skeletons';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';

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
 * is not simply static. Everything else on the page reads the 1-hour data
 * cache and never wanted two minutes.
 *
 * Five minutes since 2026-10-30: the "Today" row reads the free-rewards feed,
 * whose fetch revalidates every 300s, and the shortest cache inside a route is
 * the route's (trap 2), so the page says so rather than claiming ten.
 *
 * `/events` used to be the other page on this TTL and is no longer: the
 * rotation left it on 2026-09-24, so this component and `/maps` are now the
 * only places the live slots appear.
 */
export const revalidate = 300;

/**
 * Must match `revalidate` above, and must be passed to every component that
 * fetches something timed. Both `getEventRotation` and `getPlayerRankings`
 * default to 120s, and either one left at its default silently sets the whole
 * route — which is how this page came to rebuild every two minutes.
 */
const LIVE_REVALIDATE = 300;

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
  const t = getT(requestLocale());
  return (
    /*
      The landing page, rebuilt 2026-10-30 as a game lobby: search, today's
      three events, the meta in one row, our own findings, the live maps, the
      tools, the app. It was fourteen sections and thirteen phone screens,
      with the search box and the giveaway twice each; the long explanations
      (two games two answers, your account explained) live on their own pages.
    */
    <div className="space-y-14 sm:space-y-20">
      <script
        type="application/ld+json"
        // Static object, no user input, so there is nothing to escape here.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA) }}
      />

      <HomeHero
        stats={
          <Suspense fallback={<Skeleton className="h-12 rounded-2xl" />}>
            <HomeProof />
          </Suspense>
        }
      />

      {/* Renders nothing until the visitor has saved someone. */}
      <FavoritesList />

      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <HomeLobby />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <HomeMetaNow />
      </Suspense>

      {/* Our own findings: what no tier list says. Nothing on a quiet day. */}
      <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
        <HomeRadarSection />
      </Suspense>

      <HomeSection
        id="live-now"
        title={t('Live Brawl Stars events')}
        subtitle={t('The maps everyone is playing this slot, straight from the game API.')}
        ctaHref="/maps"
        ctaLabel={t('Every map')}
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

      <HomeBand>
        <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
          <HomeTools />
        </Suspense>
      </HomeBand>

      <HomeBubble />

      {/* While the Google Play closed test is recruiting; nothing otherwise. */}
      <HomePlayTest />
    </div>
  );
}
