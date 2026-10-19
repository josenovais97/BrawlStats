'use client';

import { useEffect, useState } from 'react';

import { usePanelI18n } from '@/components/bubble/panel-i18n';
import { panelTrack } from '@/lib/panel-telemetry';
import { BUY_ME_A_COFFEE_URL } from '@/lib/site';

const OPENS = 'brawlzone.bubble.opens';
const HIDDEN_UNTIL = 'brawlzone.bubble.supportHiddenUntil';
/** Asked only of someone who keeps coming back, never on a first visit. */
const MIN_OPENS = 10;
const DAY = 24 * 60 * 60 * 1000;

/**
 * A quiet donation ask at the foot of the panel (2026-10-19).
 *
 * Site build only: the Google Play build must not link to outside payments
 * (Play's payments policy), so it is hidden whenever the app says it is the
 * Play build (`s=play` in the hash), the same signal the update notice uses.
 * Shown after ten openings; "Not now" hides it for 30 days, tapping through
 * for 90.
 */
export function PanelSupport() {
  const { t } = usePanelI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (/(?:^|[#&])s=play(?:&|$)/.test(window.location.hash)) return;
    let visible = false;
    try {
      const opens = Number(localStorage.getItem(OPENS) ?? 0) + 1;
      localStorage.setItem(OPENS, String(opens));
      visible = opens >= MIN_OPENS && Date.now() > Number(localStorage.getItem(HIDDEN_UNTIL) ?? 0);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only facts
    setShow(visible);
  }, []);

  if (!show) return null;
  const hide = (days: number) => {
    try {
      localStorage.setItem(HIDDEN_UNTIL, String(Date.now() + days * DAY));
    } catch {}
    setShow(false);
  };

  return (
    <section className="mx-1 mt-4 rounded-xl border border-border bg-surface-2/60 px-3.5 py-3">
      <p className="text-sm font-black">☕ {t('support.title')}</p>
      <p className="mt-1 text-xs leading-snug text-foreground/85">{t('support.body')}</p>
      <div className="mt-2.5 flex items-center gap-3">
        <a
          href={BUY_ME_A_COFFEE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            panelTrack('support_tap');
            hide(90);
          }}
          className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-bold text-brand-ink"
        >
          {t('support.cta')}
        </a>
        <button type="button" onClick={() => hide(30)} className="text-[11px] font-semibold text-muted">
          {t('support.later')}
        </button>
      </div>
    </section>
  );
}
