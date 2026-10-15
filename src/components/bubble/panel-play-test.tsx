'use client';

import { useEffect, useState } from 'react';

import { usePanelI18n } from '@/components/bubble/panel-i18n';

const DISMISSED = 'brawlzone.bubble.playTestDismissed';

/**
 * Invites the panel's own readers into the Google Play closed test.
 *
 * They are the best testers there are -- people who already use the app in
 * their matches -- so the invitation goes where they look. Shown only to the
 * site build: someone on the Play build is already in. "Not now" hides it for
 * good on this phone; the link opens `/bubble/test` in the browser (the app
 * sends every non-panel link outside).
 */
export function PanelPlayTest() {
  const { t, lang } = usePanelI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED) === '1';
    } catch {}
    const playBuild = /(?:^|[#&])s=play(?:&|$)/.test(window.location.hash);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only facts
    setShow(!dismissed && !playBuild);
  }, []);

  if (!show) return null;
  const prefix = lang.startsWith('es') ? '/es' : lang.startsWith('pt') ? '/pt' : '';

  return (
    <section className="mb-2 rounded-xl border border-victory/40 bg-victory/10 px-3 py-2.5">
      <p className="text-xs font-bold text-victory">{t('playTest.title')}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted">{t('playTest.body')}</p>
      <div className="mt-2 flex items-center gap-3">
        <a
          href={`${prefix}/bubble/test`}
          className="rounded-lg bg-victory px-2.5 py-1 text-[11px] font-bold text-background"
        >
          {t('playTest.cta')}
        </a>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(DISMISSED, '1');
            } catch {}
            setShow(false);
          }}
          className="text-[11px] font-semibold text-muted"
        >
          {t('playTest.later')}
        </button>
      </div>
    </section>
  );
}
