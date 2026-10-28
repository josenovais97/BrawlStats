'use client';

import { BellRing, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { NotifyButton } from '@/components/rewards/notify-button';
import { useT } from '@/components/i18n/use-t';

/**
 * "Claimed! Want the next one first?" (2026-10-28), right after a Claim tap.
 *
 * The Notify button sat in the follow band, and on its first day nobody but
 * the owner used it. The tap on Claim is the moment someone most wants the
 * next reward, so the ask goes there. Shown only to browsers that can take
 * a notification, are not subscribed or blocked, and have not said "not now"
 * in the past week.
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

export function ClaimNudge({ vapidKey }: { vapidKey: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const eligible = useRef(false);

  useEffect(() => {
    if (!vapidKey || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission === 'denied' || snoozed()) return;
    navigator.serviceWorker
      .getRegistration('/sw.js')
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        eligible.current = !sub;
      })
      .catch(() => {
        eligible.current = true;
      });
    function onClick(e: MouseEvent) {
      if (!eligible.current || !(e.target as Element | null)?.closest('[data-claim]')) return;
      eligible.current = false;
      // After the link has gone to the game: the sheet is waiting when they come back.
      setTimeout(() => {
        setOpen(true);
        window.umami?.track('notify_nudge_shown');
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
    setOpen(false);
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
        <p className="text-sm leading-relaxed text-muted">
          {t('Get a notification on this phone the moment a new free reward appears, often hours before other sites have it. No account, turn it off any time.')}
        </p>
        <div className="flex justify-center">
          <NotifyButton vapidKey={vapidKey} from="claim" onSubscribed={() => setTimeout(() => setOpen(false), 1500)} />
        </div>
        <button type="button" onClick={dismiss} data-umami-event="notify_nudge_dismiss" className="text-sm text-muted underline">
          {t('Not now')}
        </button>
      </div>
    </div>
  );
}
