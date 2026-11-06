import { Check } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { GooglePlayBadge } from '@/components/store-badges';
import { PLAY_LIVE, PLAY_TEST } from '@/lib/bubble-app';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { getT } from '@/lib/t';

/**
 * The Google Play closed test, at the top of the landing page while it is
 * recruiting (PLAY_TEST.open).
 *
 * Under the hero rather than in the Bubble block further down: the test needs
 * twelve people in the next few days, and most visitors never scroll that far.
 * Renders nothing once the test closes, so it never outlives its purpose.
 */
export function HomePlayTest() {
  if (PLAY_LIVE) return <HomePlayLaunch />;
  if (!PLAY_TEST.open) return null;
  const t = getT(requestLocale());
  const href = localePath(requestLocale(), '/bubble/test');

  return (
    <Link
      href={href}
      data-umami-event="playtest_entry"
      data-umami-event-from="home"
      className="card card-glow card-interactive flex flex-col gap-5 border-victory/40 p-5 sm:flex-row sm:items-center sm:p-6"
    >
      <Image
        src="/bubble/app-icon.png"
        alt=""
        width={72}
        height={72}
        className="size-16 shrink-0 rounded-2xl shadow-lg shadow-black/40"
      />
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="block text-xs font-bold text-victory">{t('Google Play test')}</span>
        <span className="display block text-xl uppercase leading-tight sm:text-2xl">
          {t('Help us launch BrawlZone Bubble on Google Play')}
        </span>
        <span className="block text-sm leading-relaxed text-muted">
          {t('Google lets a new app on the Play Store only after {n} people have tested it for {days} days. Three taps, and you are one of them.', { n: PLAY_TEST.testersNeeded, days: PLAY_TEST.days })}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
        <GooglePlayBadge className="h-11 w-auto" />
        <span className="inline-flex items-center gap-2 rounded-xl bg-victory px-4 py-2 text-sm font-bold text-background">
          {t('Join the test')}
        </span>
      </span>
    </Link>
  );
}

/**
 * The launch banner (PLAY_LIVE), right under the hero. Redesigned on launch
 * day (2026-11-06) in the style of the launch video: a starburst behind the
 * app floating over the game, the official badge as the one call to action.
 * The whole banner is the link. Retire it a few weeks after launch.
 */
function HomePlayLaunch() {
  const t = getT(requestLocale());
  return (
    <a
      href={PLAY_TEST.listingUrl}
      rel="noopener"
      data-umami-event="play_store"
      data-umami-event-from="home"
      aria-label={t('Get it on Google Play')}
      className="group relative block overflow-hidden rounded-3xl border-2 border-brand/50 shadow-2xl shadow-black/50 transition-transform hover:-translate-y-0.5"
    >
      {/* Starburst, centred behind the screenshot, then faded under the text. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 78% 50%, rgba(255,197,61,0.35) 0%, rgba(255,197,61,0) 38%), repeating-conic-gradient(from 0deg at 78% 50%, #23317a 0deg 7.5deg, #16215a 7.5deg 15deg)',
        }}
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background/30 md:bg-gradient-to-r md:from-background md:via-background/80 md:to-transparent" />

      <div className="relative grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:gap-4 lg:p-10">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-victory/40 bg-victory/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-victory">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-victory opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-victory" />
            </span>
            {t('New on Google Play')}
          </span>

          <div className="flex items-center gap-4">
            <Image
              src="/bubble/app-icon.png"
              alt=""
              width={80}
              height={80}
              className="size-16 shrink-0 rounded-2xl shadow-lg shadow-black/50 ring-2 ring-white/10 sm:size-20"
            />
            <h2 className="display text-game-stroke text-2xl uppercase leading-[1.05] sm:text-4xl">
              {t('BrawlZone Bubble is on Google Play')}
            </h2>
          </div>

          <p className="max-w-xl leading-relaxed text-foreground/85">
            {t('The best picks for your map and what beats the enemy, floating over Brawl Stars while you draft. Free, no ads.')}
          </p>

          <ul className="flex flex-wrap gap-2">
            {['Free', 'No ads', 'No account'].map((chip) => (
              <li key={chip} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold backdrop-blur-sm">
                <Check className="size-3.5 text-victory" />
                {t(chip)}
              </li>
            ))}
          </ul>

          <GooglePlayBadge className="h-14 w-auto drop-shadow-[0_6px_0_rgba(0,0,0,0.45)] transition-transform group-hover:scale-[1.03] sm:h-16" />
        </div>

        {/* The bubble over a real draft: what the app is, at a glance. */}
        <div className="relative mx-auto w-full max-w-md md:max-w-none">
          <Image
            src="/bubble/over-game.jpg"
            alt={t('The BrawlZone panel open on top of the Brawl Stars lobby on a phone, showing the Ranked meta for Masters+ on Undermine')}
            width={2048}
            height={912}
            sizes="(min-width: 768px) 520px, 100vw"
            className="w-full -rotate-2 rounded-[1.75rem] border-[6px] border-[#0d1030] shadow-[0_16px_0_#0d1030,0_30px_60px_rgba(0,0,0,0.55)] transition-transform duration-300 group-hover:rotate-0"
          />
          <Image
            src="/bubble/app-icon.png"
            alt=""
            width={72}
            height={72}
            className="absolute -right-2 -top-4 size-14 rotate-6 rounded-2xl shadow-xl shadow-black/60 ring-4 ring-[#0d1030] sm:size-16"
          />
        </div>
      </div>
    </a>
  );
}
