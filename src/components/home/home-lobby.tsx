import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import { Countdown } from '@/components/giveaway/countdown';
import { getFreeRewards } from '@/lib/free-rewards';
import { BRAWL_PASS_ART, GIVEAWAY, GIVEAWAY_PUBLIC, PRIZE_FALLBACK_ART, hasClosed } from '@/lib/giveaway';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { getT } from '@/lib/t';

/**
 * "Today", right under the search (2026-10-30): the three things that are new
 * every day, as the game's own event slots -- a coloured tile each, a header
 * bar with what it is and how long it lasts, the art in the middle, one
 * button. Free rewards first: they are what most visitors come for (ChatGPT
 * alone sent 675 visits to /rewards in a week). The giveaway tile replaces
 * the home banner, the daily challenge shows today's real mystery shadow.
 *
 * A row that scrolls sideways on a phone, so the third tile peeking in says
 * there is more; three across from `sm`.
 */
export async function HomeLobby() {
  const locale = requestLocale();
  const t = getT(locale);
  const lp = (path: string) => localePath(locale, path);
  const { live } = await getFreeRewards().catch(() => ({ live: [] as Awaited<ReturnType<typeof getFreeRewards>>['live'] }));
  const reward = live[0];
  const giveaway = GIVEAWAY_PUBLIC && !hasClosed();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section aria-labelledby="today" className="min-w-0">
      <h2 id="today" className="display text-game-stroke text-3xl sm:text-4xl">{t('Today in Brawl Stars')}</h2>
      <ul className="-mx-4 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        <LobbyTile
          href={lp('/rewards')}
          tone="linear-gradient(180deg, #ffbf3a 0%, #f2860f 100%)"
          label={t('Free rewards')}
          badge={live.length ? t('{n} live', { n: live.length }) : null}
          title={reward ? reward.name : t('No free link live right now')}
          cta={reward ? t('Claim it') : t('Get the next one')}
          ctaClass="bg-[#3ddc63] text-[#0b2a14] [--btn-shadow:#1a7a33]"
          art={
            reward ? (
              /* The reward's game art, our own box if it does not load (as on /rewards). */
              <object data={reward.art} type="image/png" aria-hidden className="reward-float block size-32 sm:size-36">
                {/* eslint-disable-next-line @next/next/no-img-element -- our own fallback art */}
                <img src={reward.fallbackArt} alt="" width={140} height={140} className="size-32 object-contain sm:size-36" />
              </object>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element -- our own gift art */
              <img src="/rewards/gift.png" alt="" width={140} height={140} className="reward-float size-32 object-contain sm:size-36" />
            )
          }
        />
        {giveaway ? (
          <LobbyTile
            href={lp('/giveaway')}
            tone="linear-gradient(180deg, #a06bff 0%, #5a2fd1 100%)"
            label={t('Giveaway')}
            badge={<Countdown to={GIVEAWAY.closesAt} />}
            title={t('Win a €10 gift card for the Brawl Pass')}
            cta={t('Enter for free')}
            ctaClass="bg-brand text-brand-ink"
            umami="giveaway_banner"
            art={
              /* The Brawl Pass, falling back to our box if the wiki's art does not load. */
              <object data={BRAWL_PASS_ART} type="image/png" aria-label={t('Brawl Pass')} className="reward-float block h-32 w-52 sm:h-36 sm:w-56">
                {/* eslint-disable-next-line @next/next/no-img-element -- a small pre-compressed icon */}
                <img src={PRIZE_FALLBACK_ART} alt="" width={140} height={140} className="mx-auto size-32 object-contain" />
              </object>
            }
          />
        ) : null}
        <LobbyTile
          href={lp('/daily-challenge')}
          tone="linear-gradient(180deg, #3cc8ff 0%, #1668de 100%)"
          label={t('Daily challenge')}
          badge={t('New every day')}
          title={t('Who is this brawler?')}
          cta={t('Guess')}
          ctaClass="bg-white text-[#10142a] [--btn-shadow:#9aa3c0]"
          art={
            /* eslint-disable-next-line @next/next/no-img-element -- today's puzzle shadow, drawn by our own API */
            <img src={`/api/brawldle/picture?mode=shadow&step=0&d=${today}`} alt="" width={160} height={160} className="reward-float size-32 object-contain sm:size-36" />
          }
        />
      </ul>
    </section>
  );
}

function LobbyTile({
  href,
  tone,
  label,
  badge,
  title,
  cta,
  ctaClass,
  art,
  umami,
}: {
  href: string;
  /** The tile's colour, as a CSS background. */
  tone: string;
  label: string;
  badge: ReactNode;
  title: string;
  cta: string;
  ctaClass: string;
  art: ReactNode;
  /** Keeps a placement's existing Umami event, so the numbers stay comparable. */
  umami?: string;
}) {
  return (
    <li className="w-[78%] shrink-0 snap-center sm:w-auto">
      <Link
        href={href}
        prefetch={false}
        data-umami-event={umami}
        data-umami-event-from={umami ? 'home' : undefined}
        className="lobby-tile h-full"
        style={{ '--tone': tone } as CSSProperties}
      >
        <span className="lobby-tile-head">
          <span className="display text-game-stroke text-lg leading-none">{label}</span>
          {badge ? <span className="rounded-full bg-black/35 px-2.5 py-1 text-xs font-bold tabular-nums">{badge}</span> : null}
        </span>
        <span className="relative grid h-40 place-items-center overflow-hidden sm:h-44">
          <span aria-hidden className="reward-rays" />
          {art}
        </span>
        <span className="mt-auto flex flex-col gap-3 px-4 pb-4">
          <span className="display text-game-stroke min-h-[2.5em] text-2xl leading-[1.1]">{title}</span>
          <span className={`btn-game self-start px-5 py-2 text-lg ${ctaClass}`}>{cta}</span>
        </span>
      </Link>
    </li>
  );
}
