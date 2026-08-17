import type { Metadata } from 'next';
import { Suspense } from 'react';

import { FavoritesList } from '@/components/favorites-list';
import { HomeCoverage } from '@/components/home/home-coverage';
import { HomeCta } from '@/components/home/home-cta';
import { HomeHero } from '@/components/home/home-hero';
import { HomeLiveEvents } from '@/components/home/home-live-events';
import { HomeSection } from '@/components/home/home-section';
import { HomeTopBrawlers } from '@/components/home/home-top-brawlers';
import { HomeValueProps } from '@/components/home/home-value-props';
import { TopPlayersPreview } from '@/components/home/top-players-preview';
import { RankedListSkeleton, Skeleton } from '@/components/ui/skeletons';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'BrawlZone: Brawl Stars stats, tier list and leaderboards',
  description:
    'Look up Brawl Stars player and club stats by tag. Track trophies, rankings and progression, follow the live event rotation, check brawler win rates and browse the global leaderboard.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'BrawlZone: Brawl Stars stats, tier list and leaderboards',
    description:
      'Brawl Stars player stats, club stats, brawler win rates, live events and global leaderboards, all in one search.',
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
          subtitle="Highest win rates right now, adjusted for the sampled player pool."
          ctaHref="/tier-list"
          ctaLabel="Explore the tier list"
        >
          <Suspense fallback={<RankedListSkeleton />}>
            <HomeTopBrawlers />
          </Suspense>
        </HomeSection>

        <HomeSection
          id="top-players"
          eyebrow="Leaderboard"
          title="Top players"
          subtitle="The highest trophy counts in the world, updated through the day."
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
