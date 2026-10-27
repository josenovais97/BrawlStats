import Link from 'next/link';

import { GIVEAWAY_PUBLIC, hasClosed } from '@/lib/giveaway';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { getT } from '@/lib/t';

/**
 * The giveaway, as a strip on the landing and rewards pages (2026-10-27):
 * the same violet stage as /giveaway, small. Renders nothing once it has
 * closed, so it never outlives its purpose.
 */
export function GiveawayBanner({ from }: { from: string }) {
  if (!GIVEAWAY_PUBLIC || hasClosed()) return null;
  const t = getT(requestLocale());
  return (
    <Link
      href={localePath(requestLocale(), '/giveaway')}
      data-umami-event="giveaway_banner"
      data-umami-event-from={from}
      className="reward-stage flex items-center gap-4 px-5 py-4 sm:gap-6 sm:px-8"
    >
      <span aria-hidden className="reward-rays" />
      {/* eslint-disable-next-line @next/next/no-img-element -- a small pre-compressed icon */}
      <img src="/rewards/box-rainbow.png" alt="" width={96} height={96} className="reward-float size-16 shrink-0 object-contain sm:size-20" />
      <span className="min-w-0 flex-1">
        <span className="display text-game-stroke block text-xl leading-tight text-white sm:text-3xl">
          {t('Giveaway: win a €10 gift card')}
        </span>
        <span className="mt-1 block text-sm text-white/80">{t('Free to enter. Most points wins. Bring your friends.')}</span>
      </span>
      <span className="btn-game hidden shrink-0 bg-[#3ddc63] px-5 py-3 text-lg text-[#0b2a14] [--btn-shadow:#1a7a33] sm:inline-flex">
        {t('Enter free')}
      </span>
    </Link>
  );
}
