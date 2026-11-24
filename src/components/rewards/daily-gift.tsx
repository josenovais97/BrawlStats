'use client';

import { Timer } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useLocale } from '@/components/i18n/use-locale';
import { useT } from '@/components/i18n/use-t';
import { RewardFlag } from '@/components/rewards/claim-tracker';
import { RewardArt } from '@/components/rewards/reward-art';
import { HTML_LANG } from '@/lib/i18n';
import { DAILY_STORE_URL, dayLabel, nextStoreReset, storeDay, timeLeft } from '@/lib/store-daily';

/**
 * Today's free reward in the Supercell Store (2026-11-24), always on
 * /rewards: between link drops this is the one thing that is new every day.
 * The name is shown only for the day it was given for; the page is cached for
 * minutes, so the browser checks the clock itself.
 */
export function DailyGift({ gift, day, children }: {
  gift: { day: string; name: string; url: string; art: string; fallbackArt: string } | null;
  /** The store day the page was drawn on; the browser checks it. */
  day: string;
  /** The sentences that never change, rendered on the server for search. */
  children: React.ReactNode;
}) {
  const t = useT();
  const lang = useLocale();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is only knowable in the browser
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const known = gift && (now === null || gift.day === storeDay(now)) ? gift : null;
  const left = now === null ? null : timeLeft(now);
  const at = now === null ? null : new Intl.DateTimeFormat(HTML_LANG[lang], { hour: '2-digit', minute: '2-digit' }).format(nextStoreReset(now));
  const today = now === null ? day : storeDay(now);
  const id = `daily-${today}`;

  return (
    <section className="reward-tile flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6" aria-labelledby="daily-gift">
      <RewardArt
        key={known?.art ?? 'gift'}
        src={known?.art ?? '/rewards/gift.png'}
        fallback={known?.fallbackArt ?? '/rewards/gift.png'}
        size={112}
        className="mx-auto size-24 shrink-0 object-contain drop-shadow-[0_6px_8px_rgb(0_0_0/0.5)] sm:mx-0"
      />
      <div className="min-w-0 flex-1 space-y-1.5 text-center sm:text-left">
        <p className="text-sm font-semibold text-white/70">{t("Today's free store reward")} · <time dateTime={today}>{dayLabel(today, HTML_LANG[lang])}</time></p>
        <h2 id="daily-gift" className="display text-game-stroke text-2xl leading-tight text-white sm:text-3xl">
          {known ? known.name : t("Sign in to see today's reward")}
        </h2>
        {children}
        <p className="flex min-h-6 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm sm:justify-start">
          {left && at ? (
            <>
              <span className="inline-flex items-center gap-1.5 font-bold text-brand">
                <Timer aria-hidden className="size-4" />
                {t('Changes in {h}h {m}m', { h: left.h, m: left.m })}
              </span>
              <span className="text-white/60">{t('A new one every day at {time}, your time.', { time: at })}</span>
            </>
          ) : null}
          {now === null ? null : <RewardFlag id={id} postedAt="" />}
        </p>
      </div>
      <a
        href={known?.url ?? DAILY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer nofollow"
        data-claim
        data-haptic="success"
        data-reward-id={id}
        data-umami-event="reward_claim"
        data-umami-event-from="daily"
        className="btn-game inline-flex shrink-0 items-center justify-center bg-[#3ddc63] px-7 py-3 text-2xl text-[#0b2a14] [--btn-shadow:#1a7a33] hover:bg-[#52e676]"
      >
        {t('Claim')}
      </a>
    </section>
  );
}
