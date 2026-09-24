import type { Metadata } from 'next';
import { AlertTriangle, Ban, Gavel, Scale, Share2 } from 'lucide-react';
import Link from 'next/link';

import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site';

/**
 * The terms, written the same way the privacy page is: as a description of
 * what this actually is, not as boilerplate copied from a template.
 *
 * It exists because several third parties now require one before they will
 * deal with the site — a store listing needs it, and so does a TikTok
 * developer app. That is a poor reason to publish a bad document, so this one
 * says the true things: the site is free, it is fan-made, its numbers are
 * measured from a sample and can be wrong, and Supercell owns the game.
 *
 * Deliberately short. A long agreement nobody reads protects nobody, and every
 * clause here is one somebody might actually need: what the data is, what it
 * is not, that the app exists, and who to write to.
 */

export const metadata: Metadata = {
  alternates: { canonical: '/terms' },
  title: 'Terms of service',
  description:
    'The terms for using BrawlZone: a free, fan-made Brawl Stars statistics site. What the numbers are, what they are not, and what you may do with them.',
};

const ALLOWED = [
  'Read anything here, as often as you like, without an account.',
  'Quote or screenshot the numbers, including in videos and articles. A link back is appreciated, never required.',
  'Install and use the Android app on any device you own.',
];

const NOT_ALLOWED = [
  'Scraping the site at a rate that degrades it for other readers. There is no published API quota because there is no published API; automated traffic that costs more than it returns gets rate-limited.',
  'Passing the site off as official, or as affiliated with Supercell.',
  'Redistributing the Android app repackaged, modified, or signed with a different key.',
];

export default function TermsPage() {
  return (
    <div className="space-y-12">
      <PageHeading
        eyebrow="Terms"
        title="Terms of service"
        subtitle="Short, because the honest version is short. This site is free, fan-made, and measured rather than official."
      />

      <section className="card card-glow p-6 sm:p-8">
        <div className="flex gap-4">
          <Scale className="size-6 shrink-0 text-brand" />
          <div className="space-y-3 text-sm leading-relaxed text-muted">
            <h2 className="font-bold text-foreground">The short version</h2>
            <p>
              {SITE_NAME} is a free Brawl Stars statistics site. There is no
              account, nothing to pay for, and no advertising. Using it means
              accepting the terms on this page. If you disagree with any of
              them, the remedy is to stop using the site, and nothing is lost —
              you have given us nothing.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Not affiliated with Supercell"
          subtitle="Stated first, because it is the thing most worth being clear about."
        />
        <div className="card p-6">
          <p className="text-sm leading-relaxed text-muted">
            {SITE_NAME} is an independent, fan-made project. It is not endorsed
            by, sponsored by, or affiliated with Supercell. Brawl Stars, its
            brawler names, artwork and trademarks belong to Supercell, and are
            used here to describe the game the site is about. This site follows{' '}
            <a
              href="https://supercell.com/en/fan-content-policy/"
              rel="noopener"
              className="font-medium text-brand hover:underline"
            >
              Supercell&apos;s Fan Content Policy
            </a>
            .
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="What the numbers are"
          subtitle="And, more usefully, what they are not."
        />
        <div className="card space-y-3 p-6 text-sm leading-relaxed text-muted">
          <p>
            Every statistic here is computed from a{' '}
            <strong className="font-semibold text-foreground">sample</strong> of
            real battles, read from the official Brawl Stars API. It is not a
            census of every game played, and it is not official. Win rates,
            tier lists and recommendations are estimates with sample sizes
            printed beside them, and they can be wrong.
          </p>
          <p>
            The method is published in full, including its limitations, on{' '}
            <Link href="/meta-score" className="font-medium text-brand hover:underline">
              how the meta score is calculated
            </Link>
            . Use the numbers to inform a decision, not as a guarantee of one.
            Nothing here is advice, and no outcome in the game is promised.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading title="What you may do" />
        <ul className="card divide-y divide-border overflow-hidden">
          {ALLOWED.map((line) => (
            <li key={line} className="flex gap-3 p-5 text-sm leading-relaxed text-muted">
              <Share2 className="mt-0.5 size-4 shrink-0 text-victory" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <SectionHeading title="What you may not do" />
        <ul className="card divide-y divide-border overflow-hidden">
          {NOT_ALLOWED.map((line) => (
            <li key={line} className="flex gap-3 p-5 text-sm leading-relaxed text-muted">
              <Ban className="mt-0.5 size-4 shrink-0 text-defeat" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="The Android app"
          subtitle="It is distributed from this site, so it is covered here too."
        />
        <div className="card space-y-3 p-6 text-sm leading-relaxed text-muted">
          <p>
            The{' '}
            <Link href="/bubble" className="font-medium text-brand hover:underline">
              BrawlZone Bubble
            </Link>{' '}
            app is free and provided as-is. It draws an overlay showing this
            site&apos;s data over other apps, with your permission, and reads
            nothing from your device or from the game. What it collects is
            covered by the{' '}
            <Link href="/privacy" className="font-medium text-brand hover:underline">
              privacy policy
            </Link>
            , and the answer is nothing.
          </p>
          <p>
            It is not a modification of Brawl Stars, does not interact with the
            game, and does not automate play. Using it should not put an account
            at risk, but the site cannot make promises on Supercell&apos;s
            behalf about what their rules permit.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading title="No warranty" />
        <div className="card p-6">
          <div className="flex gap-4">
            <AlertTriangle className="size-5 shrink-0 text-brand" />
            <p className="text-sm leading-relaxed text-muted">
              The site and the app are provided &ldquo;as is&rdquo;, without
              warranty of any kind. They may be unavailable, incomplete, or
              wrong at any time. To the extent the law allows, {SITE_NAME}{' '}
              accepts no liability for any loss arising from using them —
              including decisions made in a game on the strength of a number
              printed here.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading title="Changes, and getting in touch" />
        <div className="card p-6">
          <div className="flex gap-4">
            <Gavel className="size-5 shrink-0 text-brand" />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>
                These terms may change as the site does. Material changes are
                noted in the{' '}
                <Link
                  href="/release-notes"
                  className="font-medium text-brand hover:underline"
                >
                  release notes
                </Link>
                , which are dated.
              </p>
              <p>
                Questions, corrections, or a takedown request:{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-medium text-brand hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
