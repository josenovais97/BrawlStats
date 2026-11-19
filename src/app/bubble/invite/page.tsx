import type { Metadata } from 'next';

import { InviteLanding } from '@/components/bubble/invite-landing';

/**
 * Where a Bubble friend invite lands (1.42): brawlzone.net/bubble/invite#CODE.
 *
 * One static page; the code rides in the hash, so it never reaches the
 * server log or a cache key, and there is one URL here rather than one per
 * player. The page asks the API who invited, then sends the visitor to the
 * app (or to Google Play with the code as install referrer, which the app
 * reads on first open). Not linked from anywhere and not indexed.
 */

export const metadata: Metadata = {
  title: 'You are invited to BrawlZone Bubble',
  description: 'A friend invited you to race up Ranked together with BrawlZone Bubble, the free app that floats over Brawl Stars.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/bubble/invite' },
};

export default function InvitePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center px-4 py-10">
      <InviteLanding />
    </main>
  );
}
