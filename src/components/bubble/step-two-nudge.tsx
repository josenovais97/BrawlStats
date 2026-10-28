'use client';

import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useT } from '@/components/i18n/use-t';

/**
 * The bar that brings people back for step 2 (2026-10-28).
 *
 * Umami, two weeks in: 46 tapped "Join the group", 23 tapped "Become a
 * tester", and Google counted 12 testers out of a 20-person group. The group
 * opens in a new tab and people stop there, believing they are done. Once
 * step 1 is tapped this bar stays pinned to the bottom until step 2 is, and
 * the phone remembers it, so coming back tomorrow shows it too.
 */
const KEY = 'bz-playtest';

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(v: string) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // Private mode: the bar still shows for this visit.
  }
}

export function StepTwoNudge({ optInUrl }: { optInUrl: string }) {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the flag lives in this browser only
    setShow(read() === 'group');
    function onClick(e: MouseEvent) {
      const step = (e.target as Element | null)?.closest('[data-umami-event-step]')?.getAttribute('data-umami-event-step');
      if (step === 'group' && read() !== 'optin') {
        write('group');
        setShow(true);
      } else if (step === 'optin' || step === 'install') {
        write('optin');
        setShow(false);
      }
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-victory bg-background/95 p-3 shadow-[0_-8px_24px_rgb(0_0_0/0.4)] backdrop-blur sm:p-4">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
        <p className="flex-1 text-sm">
          <span className="font-bold text-victory">{t('Joined the group? You are not a tester yet.')}</span>{' '}
          {t('One more tap: Google only counts you after step 2.')}
        </p>
        <a
          href={optInUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-umami-event="playtest_step"
          data-umami-event-step="optin"
          data-umami-event-from="nudge"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-victory px-5 py-3 font-bold text-background"
        >
          {t('Step 2: Become a tester')}
          <ArrowRight aria-hidden className="size-4" />
        </a>
      </div>
    </div>
  );
}
