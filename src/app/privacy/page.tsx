import type { Metadata } from 'next';
import { Database, HardDrive, Server, Shield, Smartphone } from 'lucide-react';
import Link from 'next/link';

import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { CONTACT_EMAIL } from '@/lib/site';

/**
 * What the site and the app collect, which is very little.
 *
 * Written as a description of the build rather than as a legal document,
 * because a policy that does not match the code is worse than none: it teaches
 * the one reader careful enough to check that the page is decoration. Every
 * claim here is something in this repository — the storage keys are the ones
 * `grep` finds, the third-party hosts are the ones `next.config.ts` allows, and
 * the analytics script is the one `layout.tsx` loads.
 *
 * It exists because the site now distributes software. An APK asks for more
 * trust than a web page, and "we collect nothing" is worth stating precisely
 * when it happens to be true.
 */

export const metadata: Metadata = {
  alternates: { canonical: '/privacy' },
  title: 'Privacy',
  description:
    'What BrawlZone stores, what it does not, and what the Android app sends. No accounts, no cookies, no personal data.',
};

const NOTHING = [
  'No account, because there is nothing to sign in to.',
  'No cookies. Not for analytics, not for preferences, not at all.',
  'No advertising, no ad networks, and no third-party trackers.',
  'No email address, name, phone number or payment details — none are ever asked for.',
];

export default function PrivacyPage() {
  return (
    <div className="space-y-12">
      <PageHeading
        eyebrow="Privacy"
        title="What we collect"
        subtitle="Very little, and this page says exactly what. Every claim below is something you can check in the source."
      />

      <section className="card card-glow p-6 sm:p-8">
        <div className="flex gap-4">
          <Shield className="size-6 shrink-0 text-brand" />
          <div>
            <h2 className="font-bold">The short version</h2>
            <ul className="mt-3 space-y-2">
              {NOTHING.map((line) => (
                <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand/60" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Analytics"
          subtitle="One counter, self-hosted, with nothing that identifies you."
        />
        <div className="card p-6">
          <div className="flex gap-4">
            <Server className="size-6 shrink-0 text-brand" />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>
                Page views are counted by{' '}
                <a
                  href="https://umami.is"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-foreground underline underline-offset-2"
                >
                  Umami
                </a>
                , running on the same server as the site rather than at a third party. It sets no
                cookies and stores no personal data, which is why there is no consent banner on
                this site — there is nothing to consent to.
              </p>
              <p>
                It records the page, the referrer, and coarse details your browser sends anyway:
                country, browser, operating system, screen size. It does not record IP addresses,
                and nothing links one visit to another or to a person.
              </p>
              <p>
                {/* Named because a reader is entitled to know what is being counted, and
                    because these are visible in the page source regardless. */}
                A few named events are also counted, all of them anonymous: installing the web
                app, opening it, and tapping the Android download. The download event carries
                which page it came from and which version was offered, so an upgrade can be told
                apart from a first install. Nothing else.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="What stays in your browser"
          subtitle="Kept on your device, never sent anywhere."
        />
        <div className="card p-6">
          <div className="flex gap-4">
            <HardDrive className="size-6 shrink-0 text-brand" />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>
                A handful of preferences live in your browser&apos;s local storage: saved players
                and clubs, recent searches, saved rosters, whether you dismissed the install
                prompt, and — in the Android app&apos;s panel — the game mode and map you last
                looked at.
              </p>
              <p>
                These never leave your device. They are not synced, not backed up by us, and not
                readable by the server. Clearing your browser data removes them, and the site
                works without them.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Looking up a player"
          subtitle="A tag you type is a request, not a record."
        />
        <div className="card p-6">
          <div className="flex gap-4">
            <Database className="size-6 shrink-0 text-brand" />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>
                Searching a player tag sends it to the official Brawl Stars API to fetch that
                profile. We do not store a record of who searched for what.
              </p>
              <p>
                Separately, BrawlZone samples public profiles and battle logs from that same
                official API to build the statistics the site is for — tier lists, map picks,
                matchups. That data is public in the game, is stored as aggregates rather than as
                a dossier on any player, and is bounded by retention windows. There is more about
                where it comes from on the{' '}
                <Link href="/about" className="font-semibold text-foreground underline underline-offset-2">
                  about page
                </Link>
                .
              </p>
              <p>
                If your profile appears in the sampled data and you would rather it did not,
                email{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-semibold text-foreground underline underline-offset-2"
                >
                  {CONTACT_EMAIL}
                </a>{' '}
                with your tag and it will be excluded.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="The Android app"
          subtitle="It asks for one permission, and it is not the one people fear."
        />
        <div className="card p-6">
          <div className="flex gap-4">
            <Smartphone className="size-6 shrink-0 text-brand" />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>
                The bubble needs <span className="font-semibold text-foreground">Display over
                other apps</span> so it can draw on top of the game. That permission lets it put
                pixels on your screen. It does not let it read your screen, and Android does not
                let one app read another&apos;s display at all.
              </p>
              <p>
                The app has no account, collects nothing, and sends nothing anywhere. Its panel is
                a web view of{' '}
                <Link
                  href="/bubble/panel"
                  className="font-semibold text-foreground underline underline-offset-2"
                >
                  a page on this site
                </Link>
                , so it counts as a page view here and nothing more. It does not read your game
                account, your files, or your other apps.
              </p>
              <p>
                It is not on the Play Store, so nothing is reported to Google about your use of
                it. The{' '}
                <Link
                  href="/bubble"
                  className="font-semibold text-foreground underline underline-offset-2"
                >
                  download page
                </Link>{' '}
                publishes a SHA-256 checksum so you can verify the file you got is the file we
                published.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Other people's servers"
          subtitle="What your browser fetches from elsewhere."
        />
        <div className="card p-6 text-sm leading-relaxed text-muted">
          <p>
            Artwork is served from Brawlify&apos;s CDN, and some images come from the Brawl Stars
            news feed, the community wiki and YouTube thumbnails. Loading an image means your
            browser contacts those hosts directly, and they see the request the way any website
            you visit does. We do not send them anything about you.
          </p>
          <p className="mt-3">
            BrawlZone is unofficial and not endorsed by Supercell. Game data comes from the
            official Brawl Stars API under their developer terms.
          </p>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-bold">Questions, or a change</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Email{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-semibold text-foreground underline underline-offset-2"
          >
            {CONTACT_EMAIL}
          </a>
          . If this page ever stops matching what the site actually does, that is a bug — say so
          and it will be fixed.
        </p>
      </section>
    </div>
  );
}
