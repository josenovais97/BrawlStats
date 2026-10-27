import type { Metadata } from 'next';
import Link from 'next/link';

import { Countdown } from '@/components/giveaway/countdown';
import { GiveawayPanel } from '@/components/giveaway/giveaway-panel';
import { DISCORD_BONUS, GIVEAWAY, GIVEAWAY_PUBLIC, isOpen } from '@/lib/giveaway';
import { leaderboard } from '@/lib/giveaway-data';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { TIKTOK_PROFILE_URL } from '@/lib/site';
import { getT } from '@/lib/t';

/**
 * The first BrawlZone giveaway (2026-10-27): a €10 gift card, one month, won
 * by whoever has the most points -- for entering, for confirming in Discord
 * and for every friend they bring. Built to bring visits and followers; see
 * lib/giveaway for the rules as code. The leaderboard is the hook: names and
 * points only, refreshed with the page every five minutes.
 */

const YOUTUBE_URL = 'https://www.youtube.com/@brawlzonenet?sub_confirmation=1';
const INSTAGRAM_URL = 'https://www.instagram.com/brawlzonenet/';

export function generateMetadata(): Metadata {
  const t = getT(requestLocale());
  return {
    alternates: { canonical: '/giveaway' },
    title: t('Brawl Stars giveaway: win a €10 gift card for the Brawl Pass'),
    description: t('Free to enter with your player tag. Get points on Discord and for every friend you bring. Most points wins.'),
    ...(GIVEAWAY_PUBLIC ? {} : { robots: { index: false, follow: false } }),
  };
}

/** The open/closed state flips on a date, so a few minutes stale at most. */
export const revalidate = 300;

export default async function GiveawayPage() {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const locale = requestLocale();
  const ends = new Date(GIVEAWAY.closesAt).toLocaleString(locale === 'en' ? 'en-GB' : locale === 'es' ? 'es-419' : 'pt-BR', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  });

  const top = await leaderboard(10);
  const ways = [
    { amount: '+1', title: t('Enter'), body: t('Your player tag and an email to reach you if you win.') },
    { amount: `+${DISCORD_BONUS}`, title: t('Join our Discord'), body: t('Type /giveaway with your code in the BrawlZone server.') },
    { amount: '+1', title: t('Each friend'), body: t('Every friend who enters with your link. No limit.') },
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
        <h2 className="display text-2xl">{t('How to get points')}</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {ways.map((w) => (
            <li key={w.title} className="reward-tile p-5">
              <p className="display text-game-stroke text-5xl leading-none text-brand">{w.amount}</p>
              <p className="display mt-3 text-xl text-white">{w.title}</p>
              <p className="mt-1 text-sm text-white/75">{w.body}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">{t('No luck involved: whoever has the most points when it ends wins. A tie goes to whoever entered first.')}</p>
      </section>

      <section id="enter" className="mx-auto max-w-xl">
        <GiveawayPanel open={GIVEAWAY_PUBLIC && isOpen()} />
      </section>

      <section className="rounded-3xl bg-surface p-6 text-center sm:p-8">
        <h2 className="display text-2xl">{t('The winner is revealed in a video')}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t('Follow so you see it the moment it is out. Following does not change your points.')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="btn-game bg-[#ff0033] px-5 py-3 text-white [--btn-shadow:#a3001f]">YouTube</a>
          <a href={TIKTOK_PROFILE_URL} target="_blank" rel="noopener noreferrer" className="btn-game bg-white px-5 py-3 text-[#10142a] [--btn-shadow:#9aa3c0]">TikTok</a>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn-game bg-[#e1306c] px-5 py-3 text-white [--btn-shadow:#8f1c45]">Instagram</a>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="display text-2xl">{t('Top recruiters right now')}</h2>
        {top.length ? (
          <ol className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
            {top.map((row, i) => (
              <li key={`${row.playerName}-${i}`} className={`flex items-center gap-4 px-4 py-3 ${i === 0 ? 'bg-brand/10' : ''}`}>
                <span className={`display w-8 text-2xl ${i === 0 ? 'text-brand' : 'text-muted'}`}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{row.playerName}</span>
                <span className="display text-xl">{t('{n} pts', { n: row.points })}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-2xl bg-surface p-5 text-sm text-muted">{t('Nobody yet. Enter now and you are first.')}</p>
        )}
        <p className="text-sm text-muted">
          {t('Updated every few minutes. Leaders are checked for fake or duplicate friends before the winner is announced.')}{' '}
          <Link href={lp('/giveaway/rules')} className="font-semibold text-brand hover:underline">{t('Read the full rules')}</Link>
        </p>
      </section>

      <p className="text-xs leading-relaxed text-muted">
        {t('Run by BrawlZone, an unofficial fan project. Not sponsored, endorsed or run by Supercell, Google, Apple, YouTube, TikTok, Instagram or Discord.')}
      </p>
    </div>
  );
}
