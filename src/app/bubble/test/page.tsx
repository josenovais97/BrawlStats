import type { Metadata } from 'next';
import { ArrowRight, CalendarCheck, Check, ExternalLink, Mail, ShieldCheck, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { GooglePlayBadge, PlayMark } from '@/components/store-badges';
import { PLAY_LIVE, PLAY_TEST } from '@/lib/bubble-app';
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
 * it asks of them (stay installed for two weeks) and what they get -- with the
 * app on screen, because "help us test an app" lands better when you can see
 * the app.
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

/** Google Groups' blue, for the one step that happens there. */
const GROUPS_BLUE = '#4285F4';

export default function BubbleTestPage() {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  // The test is over once the app is public: testers' bookmarks land on /bubble.
  if (PLAY_LIVE) redirect(lp('/bubble'));
  const open = PLAY_TEST.open;

  const steps = [
    {
      mark: (
        <span className="grid size-11 place-items-center rounded-xl" style={{ background: GROUPS_BLUE }}>
          <Users aria-hidden className="size-6 text-white" />
        </span>
      ),
      where: 'Google Groups',
      title: t('Join the testers group'),
      body: t('Open the group and tap "Join group". Use the same Google account as the Play Store on your phone.'),
      href: PLAY_TEST.groupUrl,
      cta: t('Join the group'),
      event: 'group',
    },
    {
      mark: (
        <span className="grid size-11 place-items-center rounded-xl bg-white">
          <PlayMark className="size-6" />
        </span>
      ),
      where: 'Google Play',
      title: t('Become a tester'),
      body: t('On the next page, tap "Become a tester". It can take a few minutes after joining the group before this works.'),
      href: PLAY_TEST.optInUrl,
      cta: t('Become a tester'),
      event: 'optin',
    },
    {
      mark: (
        <span className="grid size-11 place-items-center overflow-hidden rounded-xl">
          <Image src="/bubble/app-icon.png" alt="" width={44} height={44} className="size-11" />
        </span>
      ),
      where: 'Google Play',
      title: t('Install from Google Play'),
      body: t('Install BrawlZone Bubble from its Play Store page. Already have the version from this site? Play installs over it and keeps your tag and settings. If Play says the app is not found, give it a little while and try again: Google can take some time to let a new tester in.'),
      href: PLAY_TEST.listingUrl,
      cta: t('Open Google Play'),
      event: 'install',
    },
  ];

  const shots = [
    { src: '/bubble/panel-meta.png', alt: t('The panel\'s Ranked meta at Mythic: rank and mode chips across the top, then the tier list from S down, with the brawlers you do not own greyed out'), caption: t('The tier list at your rank') },
    { src: '/bubble/panel-draft.png', alt: t('The draft board on Hard Rock Mine with one ban, one team-mate and two enemies entered, and the remaining brawlers ranked by how well they answer that draft'), caption: t('Draft counters') },
    { src: '/bubble/panel-build.png', alt: t('The build card for Shade: the most-owned star power, gadget and two gears, with the share of sampled owners holding each'), caption: t('Builds on tap') },
  ];

  return (
    <div className="space-y-14 sm:space-y-20">
      {/* Hero: the ask, the badge, and the app itself. */}
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="space-y-6">
          <p className="flex items-center gap-2.5">
            <span aria-hidden className="rule h-4" />
            <span className="eyebrow">{t('Google Play test')}</span>
          </p>
          <h1 className="display text-4xl uppercase leading-[1.05] sm:text-5xl">
            {t('Help us launch BrawlZone Bubble on Google Play')}
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted">
            {t('Google lets a new app on the Play Store only after {n} people have tested it for {days} days. Three taps, and you are one of them.', { n: PLAY_TEST.testersNeeded, days: PLAY_TEST.days })}
          </p>

          {open ? (
            <div className="flex flex-wrap items-center gap-4">
              <a href="#steps" aria-label={t('Get it on Google Play')} className="transition-transform hover:-translate-y-0.5">
                <GooglePlayBadge className="h-14 w-auto" />
              </a>
              <a
                href={PLAY_TEST.groupUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-umami-event="playtest_step"
                data-umami-event-step="group"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3.5 font-bold text-brand-ink transition-transform hover:-translate-y-0.5"
              >
                {t('Start with step 1')}
                <ArrowRight aria-hidden className="size-4" />
              </a>
            </div>
          ) : (
            <p className="card border-brand/40 bg-brand/10 p-4 text-sm font-semibold text-brand">
              {t('The test opens in a few days, once Google has reviewed it. Check back soon.')}
            </p>
          )}

          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {[t('Free'), t('No ads'), t('Updates through Google Play'), t('Keeps your tag and settings')].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm font-semibold">
                <Check aria-hidden className="size-4 text-victory" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* A phone with the panel open, and the bubble floating at its edge. */}
        <div className="relative mx-auto w-full max-w-[19rem]">
          <div aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-brand/15 blur-3xl" />
          <div className="rotate-[2deg] overflow-hidden rounded-[2.2rem] border-[7px] border-[#11162b] bg-[#11162b] shadow-2xl shadow-black/50">
            <Image
              src="/bubble/panel-map.png"
              alt={t('Pinball Dreams at Mythic: the best picks on that map, your best owned pick named above the list, and the battles behind each number')}
              width={720}
              height={1360}
              className="w-full rounded-[1.7rem]"
              priority
            />
          </div>
          <Image
            src="/bubble/app-icon.png"
            alt=""
            width={96}
            height={96}
            className="absolute -left-6 top-16 size-20 -rotate-6 rounded-[1.4rem] shadow-xl shadow-black/50 ring-4 ring-background"
          />
          <span className="absolute -bottom-4 right-2 rotate-[-3deg] rounded-full bg-victory px-3 py-1.5 text-xs font-black uppercase text-background shadow-lg">
            {t('Now on Google Play')}
          </span>
        </div>
      </section>

      {/* The goal, drawn: twelve testers, fourteen days. */}
      <section className="card card-glow grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand">
            <Users aria-hidden className="size-4" />
            {t('{n} testers', { n: PLAY_TEST.testersNeeded })}
          </p>
          <div className="flex flex-wrap gap-1.5" aria-hidden>
            {Array.from({ length: PLAY_TEST.testersNeeded }, (_, i) => (
              <span key={i} className="grid size-8 place-items-center rounded-full border border-brand/40 bg-brand/10 text-brand">
                <Users className="size-4" />
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-victory">
            <CalendarCheck aria-hidden className="size-4" />
            {t('{days} days', { days: PLAY_TEST.days })}
          </p>
          <div className="grid grid-cols-7 gap-1.5" aria-hidden>
            {Array.from({ length: PLAY_TEST.days }, (_, i) => (
              <span key={i} className="grid h-8 place-items-center rounded-md border border-victory/40 bg-victory/10 text-[11px] font-bold tabular-nums text-victory">
                {i + 1}
              </span>
            ))}
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted sm:col-span-2">
          {t('Then Google reviews the app for everyone. Every tester who stays the two weeks brings that day closer.')}
        </p>
      </section>

      {/* The three steps. */}
      <section id="steps" className="scroll-mt-24 space-y-5">
        <h2 className="display text-2xl uppercase sm:text-3xl">{t('Three taps')}</h2>
        <ol className="space-y-4">
          {steps.map((step, i) => (
            <li key={step.href} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex shrink-0 items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-brand font-black text-brand-ink">{i + 1}</span>
                {step.mark}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{step.where}</p>
                <h3 className="font-bold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
              {open ? (
                <a
                  href={step.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-umami-event="playtest_step"
                  data-umami-event-step={step.event}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-brand-ink transition-opacity hover:opacity-90"
                >
                  {step.cta}
                  <ExternalLink aria-hidden className="size-4" />
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {/* What they are testing. */}
      <section className="space-y-5">
        <div className="space-y-1">
          <h2 className="display text-2xl uppercase sm:text-3xl">{t('What you are testing')}</h2>
          <p className="text-muted">{t('A draft helper that floats over Brawl Stars. Tap it mid-draft, tap again and it folds away.')}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-5">
          {shots.map((s) => (
            <figure key={s.src} className="space-y-2">
              <Image src={s.src} alt={s.alt} width={720} height={1360} className="w-full rounded-2xl border border-border" loading="lazy" />
              <figcaption className="text-center text-xs text-muted">{s.caption}</figcaption>
            </figure>
          ))}
        </div>
        <figure className="space-y-2">
          <Image
            src="/bubble/over-game.jpg"
            alt={t('The BrawlZone panel open on top of the Brawl Stars lobby on a phone, showing the Ranked meta for Masters+ on Undermine')}
            width={2048}
            height={912}
            className="w-full rounded-2xl border border-border"
            loading="lazy"
          />
          <figcaption className="text-center text-xs text-muted">{t('On a real phone, open over the game')}</figcaption>
        </figure>
      </section>

      {/* Questions people actually ask. */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3 p-6 text-sm leading-relaxed text-muted">
          <h2 className="font-bold text-foreground">{t('What it asks of you')}</h2>
          <p>{t('Keep the app installed for {days} days. Using it in your matches helps, and so does telling us what breaks. That is all: no sign-up beyond the group, no payment, nothing to fill in.', { days: PLAY_TEST.days })}</p>
          <p>{t('It is the same app as the download on this site, with the same features and languages. When it goes public, you simply keep it, and it updates through Google Play.')}</p>
        </div>
        <div className="card space-y-3 p-6 text-sm leading-relaxed text-muted">
          <h2 className="flex items-center gap-2 font-bold text-foreground">
            <ShieldCheck aria-hidden className="size-4 text-brand" />
            {t('About the group')}
          </h2>
          <p>{t('The group is only a list of testers: nobody sends messages there, and joining shows nothing to other members. You can leave the test at any time from the same pages.')}</p>
        </div>
      </section>

      <section className="card card-glow flex flex-col items-center gap-4 p-6 text-center sm:p-10">
        <Mail aria-hidden className="size-7 text-brand" />
        <p className="max-w-xl leading-relaxed text-muted">
          {t('Found a bug or have an idea? Email')}{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-foreground underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>
          {t('. Every message is read.')}
        </p>
        <Link href={lp('/bubble')} className="inline-flex items-center gap-2 font-semibold text-brand hover:underline">
          {t('More about the Bubble')}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </section>
    </div>
  );
}
