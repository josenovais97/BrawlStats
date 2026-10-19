import { requestLocale } from '@/lib/request-locale';
import { BUY_ME_A_COFFEE_URL } from '@/lib/site';
import { getT } from '@/lib/t';

/**
 * One quiet donation line under a result someone has just used (2026-10-19):
 * the moment a reader has been helped is the only one in which asking works.
 * Website only; the Bubble panel has its own, kept off the Play build.
 */
export function SupportLine() {
  const t = getT(requestLocale());
  return (
    <p className="rounded-xl border border-border bg-surface-2/50 px-4 py-3 text-sm text-muted">
      ☕ {t('BrawlZone is free and made by one person. If this helped,')}{' '}
      <a
        href={BUY_ME_A_COFFEE_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-umami-event="support_tap"
        className="font-semibold text-brand hover:underline"
      >
        {t('a coffee keeps the server running')}
      </a>
      .
    </p>
  );
}
