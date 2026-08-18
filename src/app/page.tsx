import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { FavoritesList } from '@/components/favorites-list';
import { HomeCoverage } from '@/components/home/home-coverage';
import { HomeCta } from '@/components/home/home-cta';
import { HomeHero } from '@/components/home/home-hero';
import { HomeLiveEvents } from '@/components/home/home-live-events';
import { HomeProfileDepth } from '@/components/home/home-profile-depth';
import { HomeSection } from '@/components/home/home-section';
import { HomeTopBrawlers } from '@/components/home/home-top-brawlers';
import { HomeValueProps } from '@/components/home/home-value-props';
import { TopPlayersPreview } from '@/components/home/top-players-preview';
import { RankedListSkeleton, Skeleton } from '@/components/ui/skeletons';
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
      'Skill scores, separate Ranked and trophy tier lists, a Ranked elo leaderboard, live events and player stats — all from one tag.',
  },
};

/**
 * Structured data for the search box, so the site can surface a search action
 * directly in results. The target has to be an absolute URL template.
 */
const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
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

export default function HomePage() {
  return (
    <div className="space-y-16 sm:space-y-20 lg:space-y-24">
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

      <FavoritesList />

      <HomeValueProps />

      {/* Straight after the value props: those say what the site covers, this
          says what the visitor personally gets, which is the thing that makes
          them type a tag rather than bounce. */}
      <HomeProfileDepth />

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
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          }
        >
          <HomeLiveEvents />
        </Suspense>
      </HomeSection>

      {/*
        Meta and leaderboard sit side by side on desktop: they are the same
        shape (a short ranked list) and reading them as a pair is the point.
      */}
      <div className="grid gap-16 sm:gap-20 lg:grid-cols-2 lg:gap-8">
        <HomeSection
          id="top-meta"
          eyebrow="Brawler meta"
          title="Top of the meta"
          subtitle={
            <>
              Highest win rates in competitive Ranked, adjusted for the sampled
              player pool. The{' '}
              <Link
                href="/tier-list/trophy"
                className="font-medium text-brand hover:underline"
              >
                trophy ladder
              </Link>{' '}
              is scored separately, and the answers are not the same.
            </>
          }
          ctaHref="/tier-list/ranked"
          ctaLabel="Explore the Ranked tier list"
        >
          <Suspense fallback={<RankedListSkeleton />}>
            <HomeTopBrawlers />
          </Suspense>
        </HomeSection>

        <HomeSection
          id="top-players"
          eyebrow="Leaderboard"
          title="Top players"
          subtitle={
            <>
              The highest trophy counts in the world, updated through the day —
              plus our own{' '}
              <Link
                href="/leaderboard?type=ranked"
                className="font-medium text-brand hover:underline"
              >
                Ranked elo board
              </Link>
              , which the game API does not publish at all.
            </>
          }
          ctaHref="/leaderboard"
          ctaLabel="View global leaderboard"
        >
          <Suspense fallback={<RankedListSkeleton />}>
            <TopPlayersPreview />
          </Suspense>
        </HomeSection>
      </div>

      <HomeCta />
    </div>
  );
}
