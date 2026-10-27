import Link from 'next/link';

import { BRAWL_PASS_ART, GIVEAWAY_PUBLIC, PRIZE_FALLBACK_ART, hasClosed } from '@/lib/giveaway';
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
      <object data={BRAWL_PASS_ART} type="image/png" aria-hidden className="reward-float h-14 w-24 shrink-0 sm:h-20 sm:w-32">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small pre-compressed icon */}
        <img src={PRIZE_FALLBACK_ART} alt="" width={80} height={80} className="size-14 object-contain sm:size-20" />
      </object>
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
