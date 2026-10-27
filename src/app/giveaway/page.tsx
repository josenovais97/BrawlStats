import type { Metadata } from 'next';
import Link from 'next/link';

import { Countdown } from '@/components/giveaway/countdown';
import { GiveawayPanel } from '@/components/giveaway/giveaway-panel';
import { DISCORD_BONUS, GIVEAWAY, GIVEAWAY_PUBLIC, REFERRAL_CAP, isOpen } from '@/lib/giveaway';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { TIKTOK_PROFILE_URL } from '@/lib/site';
import { getT } from '@/lib/t';

/**
 * The first BrawlZone giveaway (2026-10-27): a €10 gift card, one month,
 * entries for entering, for confirming in Discord and for friends. Built to
 * bring visits and followers; see lib/giveaway for the rules as code.
 *
 * Hidden until the owner launches it (GIVEAWAY_PUBLIC): noindex, linked from
 * nowhere, and the API refuses entries.
 */

const YOUTUBE_URL = 'https://www.youtube.com/@brawlzonenet?sub_confirmation=1';
const INSTAGRAM_URL = 'https://www.instagram.com/brawlzonenet/';

export function generateMetadata(): Metadata {
  const t = getT(requestLocale());
  return {
    alternates: { canonical: '/giveaway' },
    title: t('Brawl Stars giveaway: win a €10 gift card for the Brawl Pass'),
    description: t('Free to enter with your player tag. Get more entries on Discord and for every friend you bring. One winner, drawn in public.'),
    ...(GIVEAWAY_PUBLIC ? {} : { robots: { index: false, follow: false } }),
  };
}

/** The open/closed state flips on a date, so a few minutes stale at most. */
export const revalidate = 300;

export default function GiveawayPage() {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const locale = requestLocale();
  const ends = new Date(GIVEAWAY.closesAt).toLocaleString(locale === 'en' ? 'en-GB' : locale === 'es' ? 'es-419' : 'pt-BR', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  });

  const ways = [
    { amount: '+1', title: t('Enter'), body: t('Your player tag and an email to reach you if you win.') },
    { amount: `+${DISCORD_BONUS}`, title: t('Join our Discord'), body: t('Type /giveaway with your code in the BrawlZone server.') },
    { amount: '+1', title: t('Each friend'), body: t('Every friend who enters with your link, up to {max}.', { max: REFERRAL_CAP }) },
  ];

  return (
    <div className="space-y-12">
      <section className="reward-stage px-5 pb-10 pt-6 text-center sm:px-10 sm:pb-12">
        <div aria-hidden className="reward-rays" />
        <p className="inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-sm font-semibold">
          <span className="live-dot" />
          {t('Ends in')} <Countdown to={GIVEAWAY.closesAt} />
        </p>
        <div className="relative mx-auto mt-6 w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- a small pre-compressed icon */}
          <img src="/rewards/box-rainbow.png" alt="" width={240} height={240} className="reward-float mx-auto size-48 object-contain sm:size-60" />
          <span className="display absolute -right-6 top-2 rotate-12 rounded-2xl border-[3px] border-[#10142a] bg-brand px-3 py-1 text-3xl text-brand-ink shadow-[0_4px_0_#10142a]">
            €10
          </span>
        </div>
        <h1 className="display text-game-stroke mx-auto mt-4 max-w-2xl text-4xl leading-tight text-white sm:text-6xl">
          {t('Win a €10 gift card for the Brawl Pass')}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-white/80">
          {t('Google Play or App Store, your choice. Free to enter. One winner on {date}.', { date: ends })}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="display text-2xl">{t('How to get entries')}</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {ways.map((w) => (
            <li key={w.title} className="reward-tile p-5">
              <p className="display text-game-stroke text-5xl leading-none text-brand">{w.amount}</p>
              <p className="display mt-3 text-xl text-white">{w.title}</p>
              <p className="mt-1 text-sm text-white/75">{w.body}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">{t('More entries, more chances: someone with 5 entries is 5 times as likely to win as someone with 1.')}</p>
      </section>

      <section id="enter" className="mx-auto max-w-xl">
        <GiveawayPanel open={GIVEAWAY_PUBLIC && isOpen()} />
      </section>

      <section className="rounded-3xl bg-surface p-6 text-center sm:p-8">
        <h2 className="display text-2xl">{t('The winner is revealed in a video')}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t('Follow so you see it the moment it is out. Following does not change your entries.')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="btn-game bg-[#ff0033] px-5 py-3 text-white [--btn-shadow:#a3001f]">YouTube</a>
          <a href={TIKTOK_PROFILE_URL} target="_blank" rel="noopener noreferrer" className="btn-game bg-white px-5 py-3 text-[#10142a] [--btn-shadow:#9aa3c0]">TikTok</a>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn-game bg-[#e1306c] px-5 py-3 text-white [--btn-shadow:#8f1c45]">Instagram</a>
        </div>
      </section>

      <section className="space-y-2 text-sm text-muted">
        <h2 className="display text-xl text-foreground">{t('A draw nobody can rig, us included')}</h2>
        <p>{t('When entries close, the winner is picked using a public random number that nobody can know in advance: the drand beacon, published every 30 seconds by a group of universities and companies. We publish the full entry list (tags only) and the number, so anyone can check the result.')}</p>
        <p>
          <Link href={lp('/giveaway/rules')} className="font-semibold text-brand hover:underline">{t('Read the full rules')}</Link>
        </p>
      </section>

      <p className="text-xs leading-relaxed text-muted">
        {t('Run by BrawlZone, an unofficial fan project. Not sponsored, endorsed or run by Supercell, Google, Apple, YouTube, TikTok, Instagram or Discord.')}
      </p>
    </div>
  );
}
