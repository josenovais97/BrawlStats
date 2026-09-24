import type { Metadata } from 'next';

import { CommunityEvents } from '@/components/events/community-events';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading } from '@/components/ui/section-heading';
import { getCommunityEvents } from '@/lib/community-events';

/**
 * Community events: the game-wide challenges the whole player base grinds.
 *
 * This page used to be the live map rotation, and the rotation is gone from it
 * rather than moved. It was the same content twice over — `/maps` is the map
 * catalogue, `/ranked` is the Ranked pool, and the home page already carries
 * three live slots as a teaser — so the page was a fourth presentation of
 * something the site says better elsewhere, and the thing it was uniquely
 * placed to answer was buried underneath.
 *
 * What is left is the part nothing else publishes. No API carries community
 * events; the game announces them in-client and on social media, and once one
 * ends the only durable record is the wiki's write-up. See
 * `lib/community-events` for how that is read and why it expects a mess.
 */

/*
 * Six hours, matching the wiki read inside it.
 *
 * The 600s here was the rotation's, and it went with the rotation. A route's
 * revalidate is the shortest-lived fetch inside it (AGENTS.md trap 2), so
 * leaving it would have re-rendered this page twelve times an hour to show
 * identical wiki text.
 */
export const revalidate = 21_600;

export const metadata: Metadata = {
  alternates: { canonical: '/events' },
  title: 'Brawl Stars community events and rewards',
  description:
    'Every Brawl Stars community event: the milestones the whole player base had to hit, what each one paid out, and when it ran.',
  openGraph: {
    title: 'Brawl Stars community events and rewards',
    description:
      'Milestones, tasks and rewards for every game-wide community event.',
  },
};

export default async function EventsPage() {
  // An unreachable wiki empties the list rather than failing the page.
  const community = await getCommunityEvents().catch(() => []);

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Community events', path: '/events' },
        ])}
      />

      <PageHeading
        eyebrow="Everyone, one target"
        title="Community events"
        subtitle="Game-wide challenges: the whole player base grinds one milestone, and everybody collects the reward."
      />

      {community.length === 0 ? (
        <p className="card p-6 text-sm leading-relaxed text-muted">
          The community-event write-ups could not be read just now. They come
          from the Brawl Stars wiki and this fills back in on its own.
        </p>
      ) : (
        <CommunityEvents events={community} />
      )}
    </div>
  );
}
