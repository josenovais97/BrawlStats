'use client';

import { useEffect, useState } from 'react';

import { usePanelI18n } from '@/components/bubble/panel-i18n';
import { panelTrack } from '@/lib/panel-telemetry';

const DISMISSED = 'brawlzone.bubble.playTestDismissed';
/** "Remind me tomorrow" hides it for this long, not for good (2026-10-15). */
const SNOOZE_MS = 24 * 60 * 60 * 1000;

/**
 * Invites the panel's own readers into the Google Play closed test.
 *
 * They are the best testers there are -- people who already use the app in
 * their matches -- so the invitation goes where they look. Shown only to the
 * site build: someone on the Play build is already in. Since 2026-10-15 it asks
 * them to move rather than to help: same app, kept updated by Play, installed
 * over this one with the tag kept. "Remind me tomorrow" snoozes it for a day
 * (it used to hide it for good, which an earlier "1" in storage still reads
 * as: not a timestamp, so the card comes back once). The link opens
 * `/bubble/test` in the browser (the app sends every non-panel link outside).
 */
export function PanelPlayTest() {
  const { t, lang } = usePanelI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      const at = Number(localStorage.getItem(DISMISSED));
      dismissed = at > 1 && Date.now() - at < SNOOZE_MS;
    } catch {}
    const playBuild = /(?:^|[#&])s=play(?:&|$)/.test(window.location.hash);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only facts
    setShow(!dismissed && !playBuild);
  }, []);

  if (!show) return null;
  const prefix = lang.startsWith('es') ? '/es' : lang.startsWith('pt') ? '/pt' : '';

  return (
    <section className="mb-2 rounded-xl border-2 border-victory/60 bg-victory/15 px-3.5 py-3">
      <p className="text-sm font-black text-victory">{t('playTest.title')}</p>
      <p className="mt-1 text-xs leading-snug text-foreground/85">{t('playTest.body')}</p>
      <div className="mt-2.5 flex items-center gap-3">
        <a
          href={`${prefix}/bubble/test`}
          onClick={() => panelTrack('playtest_entry', { from: 'panel' })}
          className="rounded-lg bg-victory px-3.5 py-1.5 text-xs font-bold text-background"
        >
          {t('playTest.cta')}
        </a>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(DISMISSED, String(Date.now()));
            } catch {}
            panelTrack('playtest_snooze');
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
