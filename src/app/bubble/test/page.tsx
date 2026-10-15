import type { Metadata } from 'next';
import { ExternalLink, Mail, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { PageHeading } from '@/components/ui/section-heading';
import { PLAY_TEST } from '@/lib/bubble-app';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { CONTACT_EMAIL } from '@/lib/site';
import { getT } from '@/lib/t';

/**
 * Recruiting testers for the Google Play closed test (see `PLAY_TEST`).
 *
 * Three steps, each one button, in the order Play requires them: the group
 * first, because the opt-in page refuses an account that is not in it yet.
 * Written for a player who has never heard of a closed test: what it is, what
 * it asks of them (stay installed for two weeks) and what they get.
 *
 * Not indexed: it is a temporary page with a shelf life of a few weeks, and
 * nothing a search should land on once the app is public.
 */

export const metadata: Metadata = {
  alternates: { canonical: '/bubble/test' },
  title: 'Help launch BrawlZone Bubble on Google Play',
  description:
    'Join the Google Play test of BrawlZone Bubble, the draft helper that floats over Brawl Stars. Three taps, free, no ads.',
  robots: { index: false, follow: true },
};

export default function BubbleTestPage() {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);

  const steps = [
    {
      title: t('Join the testers group'),
      body: t('Open the group and tap "Join group". Use the same Google account as the Play Store on your phone.'),
      href: PLAY_TEST.groupUrl,
      cta: t('Join the group'),
    },
    {
      title: t('Become a tester'),
      body: t('On the next page, tap "Become a tester". It can take a few minutes after joining the group before this works.'),
      href: PLAY_TEST.optInUrl,
      cta: t('Become a tester'),
    },
    {
      title: t('Install from Google Play'),
      body: t('Install BrawlZone Bubble from its Play Store page. Already have the version from this site? Play installs over it and keeps your tag and settings.'),
      href: PLAY_TEST.listingUrl,
      cta: t('Open Google Play'),
    },
  ];

  return (
    <div className="space-y-10">
      <PageHeading
        eyebrow={t('Google Play test')}
        title={t('Help us launch BrawlZone Bubble on Google Play')}
        subtitle={t('Google lets a new app on the Play Store only after {n} people have tested it for {days} days. Three taps, and you are one of them.', { n: PLAY_TEST.testersNeeded, days: PLAY_TEST.days })}
      />

      {!PLAY_TEST.open ? (
        <p className="card border-brand/40 bg-brand/10 p-4 text-sm font-semibold text-brand">
          {t('The test opens in a few days, once Google has reviewed it. Check back soon.')}
        </p>
      ) : null}

      <ol className="space-y-4">
        {steps.map((step, i) => (
          <li key={step.href} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand font-black text-brand-ink">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
            {PLAY_TEST.open ? (
              <a
                href={step.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-brand-ink transition-opacity hover:opacity-90"
              >
                {step.cta}
                <ExternalLink aria-hidden className="size-4" />
              </a>
            ) : null}
          </li>
        ))}
      </ol>

      <section className="card space-y-3 p-6 text-sm leading-relaxed text-muted">
        <h2 className="font-bold text-foreground">{t('What it asks of you')}</h2>
        <p>{t('Keep the app installed for {days} days. Using it in your matches helps, and so does telling us what breaks. That is all: no sign-up beyond the group, no payment, nothing to fill in.', { days: PLAY_TEST.days })}</p>
        <p>{t('It is the same app as the download on this site, with the same features and languages. When it goes public, you simply keep it, and it updates through Google Play.')}</p>
        <p className="flex gap-2">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>{t('The group is only a list of testers: nobody sends messages there, and joining shows nothing to other members. You can leave the test at any time from the same pages.')}</span>
        </p>
      </section>

      <section className="card flex gap-3 p-6 text-sm leading-relaxed text-muted">
        <Mail aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
        <p>
          {t('Found a bug or have an idea? Email')}{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-foreground underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>
          {t('. Every message is read.')}{' '}
          <Link href={lp('/bubble')} className="font-semibold text-brand hover:underline">
            {t('More about the Bubble')}
          </Link>
        </p>
      </section>
    </div>
  );
}
