'use client';

import { BellRing, Check } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useLocale } from '@/components/i18n/use-locale';
import { useT } from '@/components/i18n/use-t';

/**
 * "Notify me when a new reward drops" (2026-10-28): browser push through
 * /sw.js. Works on Android Chrome and desktop browsers; on an iPhone only once
 * the site is added to the home screen, which the hint says.
 */
type State = 'loading' | 'unsupported' | 'off' | 'on' | 'denied' | 'busy';

function keyBytes(b64u: string): Uint8Array {
  const pad = '='.repeat((4 - (b64u.length % 4)) % 4);
  const raw = atob((b64u + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function NotifyButton({
  vapidKey,
  from = 'page',
  onSubscribed,
}: {
  vapidKey: string;
  /** Where the tap came from, for the Umami event. */
  from?: string;
  onSubscribed?: () => void;
}) {
  const t = useT();
  const lang = useLocale();
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !vapidKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- push support is only knowable in the browser
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    navigator.serviceWorker
      .getRegistration('/sw.js')
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, [vapidKey]);

  async function turnOn() {
    setState('busy');
    try {
      if ((await Notification.requestPermission()) !== 'granted') {
        setState(Notification.permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) as BufferSource }));
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), lang }),
      });
      setState(res.ok ? 'on' : 'off');
      if (res.ok) onSubscribed?.();
    } catch {
      setState('off');
    }
  }

  async function turnOff() {
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
    } finally {
      setState('off');
    }
  }

  if (state === 'loading') return null;
  if (state === 'unsupported') {
    return <p className="text-xs text-muted">{t('Notifications: open this page in Chrome on Android, or add the site to your home screen on iPhone.')}</p>;
  }
  if (state === 'denied') {
    return <p className="text-xs text-muted">{t('Notifications are blocked for this site. Allow them in your browser settings to get new rewards.')}</p>;
  }
  if (state === 'on') {
    return (
      <span className="inline-flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-xl bg-victory/15 px-4 py-3 font-bold text-victory">
          <Check aria-hidden className="size-5" />
          {t('You will be notified')}
        </span>
        <button type="button" onClick={turnOff} className="text-sm text-muted underline">
          {t('Turn off')}
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={turnOn}
      disabled={state === 'busy'}
      data-umami-event="rewards_notify"
      data-umami-event-from={from}
      className="btn-game inline-flex items-center gap-2 bg-brand px-5 py-3 text-brand-ink disabled:opacity-60"
    >
      <BellRing aria-hidden className="size-5" />
      {t('Notify me when a new reward drops')}
    </button>
  );
}
