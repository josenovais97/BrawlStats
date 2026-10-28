'use client';

import { useEffect, useState } from 'react';

import { useLocale } from '@/components/i18n/use-locale';
import { useT } from '@/components/i18n/use-t';

/**
 * "Checked for new rewards 2 minutes ago" (2026-10-28). Read in the browser
 * from the file brawlzone-rewards-watch writes on every run that reached a
 * source: the page itself is cached for five minutes, which would make a
 * two-minute check look ten minutes stale. Shows nothing if the file is
 * missing or older than an hour -- a stale "checked" line is worse than none.
 */
const TAG: Record<string, string> = { en: 'en', es: 'es', pt: 'pt-BR' };

export function LastChecked() {
  const t = useT();
  const lang = useLocale();
  const [at, setAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    fetch('/social/rewards/checked.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { checkedAt?: string } | null) => {
        const ms = d?.checkedAt ? Date.parse(d.checkedAt) : NaN;
        if (Number.isFinite(ms)) setAt(ms);
      })
      .catch(() => {});
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (at === null || now - at > 3_600_000) return null;
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  const when = new Intl.RelativeTimeFormat(TAG[lang] ?? 'en', { numeric: 'auto' }).format(-minutes, 'minute');
  return (
    <p className="inline-flex items-center gap-2 text-sm text-muted">
      <span aria-hidden className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-victory opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-victory" />
      </span>
      {t('Checked for new rewards {when}. New ones show up here within minutes.', { when })}
    </p>
  );
}
