'use client';

import { BellRing, Share, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { NotifyButton } from '@/components/rewards/notify-button';
import { useT } from '@/components/i18n/use-t';
import { WHATSAPP_URL } from '@/lib/site';

/**
 * "Claimed! Want the next one first?" (2026-10-28), right after a Claim tap.
 *
 * The Notify button sat in the follow band, and on its first day nobody but
 * the owner used it. The tap on Claim is the moment someone most wants the
 * next reward, so the ask goes there. Shown only to browsers that can take
 * a notification, are not subscribed or blocked, and have not said "not now"
 * in the past week.
 *
 * 2026-10-30: and to everyone else, with the channels instead. iPhone Safari
 * has no web push outside a home-screen app, so the sheet never opened there:
 * of 104 iPhone visitors from ChatGPT in a week, 68 claimed and none was
 * offered a way to hear about the next one. They get the home-screen steps
 * (push works from there) and the WhatsApp and Discord buttons; a browser
 * with notifications blocked gets the buttons.
 */
const SNOOZE_KEY = 'bz-notify-nudge';
const WEEK = 7 * 86_400_000;

function snoozed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(SNOOZE_KEY) || 0) < WEEK;
  } catch {
    return false;
  }
}

type Mode = 'push' | 'follow';

export function ClaimNudge({ vapidKey, discordUrl }: { vapidKey: string; discordUrl: string }) {
  const t = useT();
  const [open, setOpen] = useState<Mode | null>(null);
  const [iphone, setIphone] = useState(false);
  const eligible = useRef<Mode | null>(null);

  useEffect(() => {
    if (snoozed()) return;
    const push = !!vapidKey && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!push || Notification.permission === 'denied') {
      eligible.current = 'follow';
      // iPadOS reports itself as a Mac, so a touch screen gives it away.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the device is only knowable in the browser
      setIphone(/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
    } else {
      navigator.serviceWorker
        .getRegistration('/sw.js')
        .then((reg) => reg?.pushManager.getSubscription())
        .then((sub) => {
          eligible.current = sub ? null : 'push';
        })
        .catch(() => {
          eligible.current = 'push';
        });
    }
    function onClick(e: MouseEvent) {
      const mode = eligible.current;
      if (!mode || !(e.target as Element | null)?.closest('[data-claim]')) return;
      eligible.current = null;
      // After the link has gone to the game: the sheet is waiting when they come back.
      setTimeout(() => {
        setOpen(mode);
        window.umami?.track('notify_nudge_shown', { mode });
      }, 400);
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [vapidKey]);

  function dismiss() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      // Private mode: it just asks again next visit.
    }
    setOpen(null);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={dismiss}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-nudge-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md space-y-4 rounded-3xl border-2 border-brand/50 bg-surface p-6 text-center shadow-2xl"
      >
        <button type="button" onClick={dismiss} aria-label={t('Close')} className="absolute right-4 top-4 text-muted hover:text-foreground">
          <X className="size-5" />
        </button>
        <BellRing aria-hidden className="mx-auto size-10 text-brand" />
        <h2 id="claim-nudge-title" className="display text-2xl">{t('🎁 Claimed! Want the next one first?')}</h2>
        {open === 'push' ? (
          <>
            <p className="text-sm leading-relaxed text-muted">
              {t('Get a notification on this phone the moment a new free reward appears, often hours before other sites have it. No account, turn it off any time.')}
            </p>
            <div className="flex justify-center">
              <NotifyButton vapidKey={vapidKey} from="claim" onSubscribed={() => setTimeout(() => setOpen(null), 1500)} />
            </div>
          </>
        ) : (
          <>
            {iphone ? (
              <p className="rounded-2xl bg-surface-2 p-4 text-left text-sm leading-relaxed">
                {t('On iPhone, notifications work once BrawlZone is on your home screen: tap')}{' '}
                <Share aria-label={t('Share')} className="inline size-4 align-text-bottom text-brand" />{' '}
                {t('Share, then "Add to Home Screen", and open BrawlZone from there.')}
              </p>
            ) : null}
            <p className="text-sm leading-relaxed text-muted">
              {iphone
                ? t('Or follow a channel: a new link goes out the moment it is found.')
                : t('Follow a channel: a new link goes out the moment it is found, often hours before other sites have it.')}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-umami-event="nudge_follow"
                data-umami-event-to="whatsapp"
                className="btn-game inline-flex items-center gap-2 bg-[#25d366] px-5 py-3 text-[#06260f] [--btn-shadow:#12803c]"
              >
                {t('WhatsApp channel')}
              </a>
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-umami-event="nudge_follow"
                data-umami-event-to="discord"
                className="btn-game inline-flex items-center gap-2 bg-[#5865f2] px-5 py-3 text-white [--btn-shadow:#343c9e]"
              >
                {t('Discord server')}
              </a>
            </div>
          </>
        )}
        <button type="button" onClick={dismiss} data-umami-event="notify_nudge_dismiss" className="text-sm text-muted underline">
          {t('Not now')}
        </button>
      </div>
    </div>
  );
}
