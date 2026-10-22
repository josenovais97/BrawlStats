import { Gift, MessageCircle } from 'lucide-react';

import { WHATSAPP_URL } from '@/lib/site';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';

/**
 * The WhatsApp channel, on the landing page (2026-10-22).
 *
 * Free reward links expire, so they are the one thing worth following a
 * channel for: brawlzone-rewards finds them and they are shared there. Until now
 * the channel was only in the footer, which few visitors reach. One slim card
 * rather than a section: it is an invitation, not a feature.
 */
export function HomeFollow() {
  const t = getT(requestLocale());
  return (
    <section aria-label={t('Free reward links')} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Gift aria-hidden className="mt-0.5 size-6 shrink-0 text-brand" />
        <div>
          <h2 className="display text-xl">{t('Free reward links, the day they drop')}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t('Supercell gives away free Starr Drops and boxes through links that expire. We share every one we find on our WhatsApp channel.')}</p>
        </div>
      </div>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink transition-opacity hover:opacity-90"
      >
        {/* A generic chat bubble, not WhatsApp's glyph: the footer's trademark rule. */}
        <MessageCircle aria-hidden className="size-4" />
        {t('Follow on WhatsApp')}
      </a>
    </section>
  );
}
