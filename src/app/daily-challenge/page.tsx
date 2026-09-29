import type { Metadata } from 'next';
import Link from 'next/link';

import { ChallengeBoard } from '@/components/challenge/challenge-board';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { brawldleRoster, pickerEntries } from '@/lib/brawldle-data';

/**
 * Guess the brawler. One puzzle a day, the same one for everybody.
 *
 * The answer is not on this page. The board sends each guess to
 * /api/brawldle/guess and renders what comes back, so the solution is never in
 * the HTML -- which is the difference between a puzzle and a page with the
 * answer written at the bottom.
 *
 * Hourly rather than daily revalidate. The tier clue moves when the sampler
 * runs, and a day-long cache would serve a clue that disagrees with
 * /tier-list/ranked. The answer itself is a pure function of the date, so it
 * does not move within a day regardless. The three combat clues are cached for
 * a day inside `getCombatTiers`, which is right for values that only change on
 * a balance patch.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Brawl Stars daily challenge — guess the brawler',
  description:
    'A new Brawl Stars brawler to guess every day. Each guess tells you how close you are on rarity, class, movement, range, reload, release order and tier. Free, no account, one puzzle a day.',
  alternates: { canonical: '/daily-challenge' },
};

export default async function DailyChallengePage() {
  const roster = await brawldleRoster().catch(() => []);
  const date = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Daily challenge', path: '/daily-challenge' },
        ])}
      />

      <PageHeading
        title="Daily challenge"
        subtitle="One brawler a day. Everybody gets the same one, and it changes at midnight UTC."
      />

      {roster.length === 0 ? (
        <p className="card p-6 text-sm leading-relaxed text-muted">
          Today&rsquo;s puzzle could not be prepared. It returns once the brawler catalogue is
          reachable again.
        </p>
      ) : (
        <ChallengeBoard date={date} picker={pickerEntries(roster)} />
      )}

      <section className="space-y-3">
        <SectionHeading title="How the clues work" />
        <div className="card space-y-2 p-5 text-sm leading-relaxed text-muted">
          <p>
            <span className="font-semibold text-emerald-300">Green</span> is exact.{' '}
            <span className="font-semibold text-amber-300">Amber</span> is one step away — an
            adjacent rarity, a neighbouring tier, or a brawler released within five of the answer.
            An arrow points toward the answer: ▲ means higher, ▼ means lower.
          </p>
          <p>
            <strong className="text-foreground">Movement</strong>,{' '}
            <strong className="text-foreground">range</strong> and{' '}
            <strong className="text-foreground">reload</strong> are the named tiers the game uses —
            Very Slow through Very Fast, Very Short through Very Long — not raw numbers, because
            nobody knows whether 855 is fast and everybody knows Very Fast beats Fast.
          </p>
          <p>
            <strong className="text-foreground">Released</strong> is the brawler&rsquo;s place in
            release order, not a date. <strong className="text-foreground">Tier</strong> comes from
            the live{' '}
            <Link href="/tier-list/ranked" className="font-medium text-brand hover:underline">
              ranked tier list
            </Link>
            , so it moves with the meta and always matches what the rest of the site says.
          </p>
          <p>
            Class has no arrow, because there is no direction from Marksman to Tank. A brawler with
            too few ranked battles to be tiered shows a dash rather than a guess.
          </p>
          <p>
            <strong className="text-foreground">Stuck?</strong> After four guesses the board shows
            the answer&rsquo;s star power, and after eight its gadget — the real icons from the
            game, with the names withheld, because a name is searchable and a picture is a memory
            test.
          </p>
          <p>
            Your progress is kept in this browser only. No account, nothing stored on our side.
          </p>
        </div>
      </section>
    </div>
  );
}
