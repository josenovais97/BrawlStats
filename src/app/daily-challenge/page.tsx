import type { Metadata } from 'next';
import Link from 'next/link';

import { ChallengeBoard } from '@/components/challenge/challenge-board';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { brawldleRoster, pickerEntries } from '@/lib/brawldle-data';
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

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
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
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
        title={t('Daily challenge')}
        subtitle={t('One brawler a day. Everybody gets the same one, and it changes at midnight UTC.')}
      />

      {roster.length === 0 ? (
        <p className="card p-6 text-sm leading-relaxed text-muted">{t('Today’s puzzle could not be prepared. It returns once the brawler catalogue is reachable again.')}</p>
      ) : (
        <ChallengeBoard date={date} picker={pickerEntries(roster)} />
      )}

      <section className="space-y-3">
        <SectionHeading title={t('How the clues work')} />
        <div className="card space-y-2 p-5 text-sm leading-relaxed text-muted">
          <p>
            <span className="font-semibold text-emerald-300">{t('Green')}</span>{' '}{t('is exact.')}{' '}
            <span className="font-semibold text-amber-300">{t('Amber')}</span>{' '}{t('is one step away — an adjacent rarity, a neighbouring tier, or a brawler released within five of the answer. An arrow points toward the answer: ▲ means higher, ▼ means lower.')}</p>
          <p>
            <strong className="text-foreground">{t('Movement')}</strong>,{' '}
            <strong className="text-foreground">{t('range')}</strong>{' '}{t('and')}{' '}
            <strong className="text-foreground">{t('reload')}</strong>{' '}{t('are the named tiers the game uses — Very Slow through Very Fast, Very Short through Very Long — not raw numbers, because nobody knows whether 855 is fast and everybody knows Very Fast beats Fast.')}</p>
          <p>
            <strong className="text-foreground">{t('Released')}</strong>{' '}{t('is the brawler’s place in release order, not a date.')}{' '}<strong className="text-foreground">{t('Tier')}</strong>{' '}{t('comes from the live')}{' '}
            <Link href={lp('/tier-list/ranked')} className="font-medium text-brand hover:underline">{t('ranked tier list')}</Link>{t(', so it moves with the meta and always matches what the rest of the site says.')}</p>
          <p>{t('Class has no arrow, because there is no direction from Marksman to Tank. A brawler with too few ranked battles to be tiered shows a dash rather than a guess.')}</p>
          <p>
            <strong className="text-foreground">{t('Stuck?')}</strong>{' '}{t('After four guesses the board shows the answer’s star power, and after eight its gadget — the real icons from the game, with the names withheld, because a name is searchable and a picture is a memory test.')}</p>
          <p>{t('Your progress is kept in this browser only. No account, nothing stored on our side.')}</p>
        </div>
      </section>
    </div>
  );
}
