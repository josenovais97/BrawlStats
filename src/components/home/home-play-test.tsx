import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { GooglePlayBadge } from '@/components/store-badges';
import { PLAY_TEST } from '@/lib/bubble-app';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { getT } from '@/lib/t';

/**
 * The Google Play closed test, at the top of the landing page while it is
 * recruiting (PLAY_TEST.open).
 *
 * Under the hero rather than in the Bubble block further down: the test needs
 * twelve people in the next few days, and most visitors never scroll that far.
 * Renders nothing once the test closes, so it never outlives its purpose.
 */
export function HomePlayTest() {
  if (!PLAY_TEST.open) return null;
  const t = getT(requestLocale());
  const href = localePath(requestLocale(), '/bubble/test');

  return (
    <Link
      href={href}
      className="card card-glow card-interactive flex flex-col gap-5 border-victory/40 p-5 sm:flex-row sm:items-center sm:p-6"
    >
      <Image
        src="/bubble/app-icon.png"
        alt=""
        width={72}
        height={72}
        className="size-16 shrink-0 rounded-2xl shadow-lg shadow-black/40"
      />
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="block text-xs font-bold uppercase tracking-wide text-victory">{t('Google Play test')}</span>
        <span className="display block text-xl uppercase leading-tight sm:text-2xl">
          {t('Help us launch BrawlZone Bubble on Google Play')}
        </span>
        <span className="block text-sm leading-relaxed text-muted">
          {t('Google lets a new app on the Play Store only after {n} people have tested it for {days} days. Three taps, and you are one of them.', { n: PLAY_TEST.testersNeeded, days: PLAY_TEST.days })}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
        <GooglePlayBadge className="h-11 w-auto" />
        <span className="inline-flex items-center gap-2 rounded-xl bg-victory px-4 py-2 text-sm font-bold text-background">
          {t('Join the test')}
          <ArrowRight aria-hidden className="size-4" />
        </span>
      </span>
    </Link>
  );
}
