'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useLp } from '@/components/i18n/use-lp';
import { useT } from '@/components/i18n/use-t';
import { GIVEAWAY_PUBLIC, hasClosed } from '@/lib/giveaway';

/**
 * A thin giveaway line under the header on every page (2026-10-28).
 *
 * Day one: of ~350 visitors, 28 opened /giveaway (the banners were only on
 * the home and rewards pages) and about one in five of those entered -- the
 * page converts, it was just not seen. Not on the Bubble panel or tester page
 * (the Play listing promises a clean panel, like AdsenseLoader's AD_FREE),
 * nor on the giveaway's own pages. Gone once the giveaway closes.
 */
const HIDDEN = [/^\/(?:es\/|pt\/)?bubble\/(?:panel|test)/, /^\/(?:es\/|pt\/)?giveaway/];

export function GiveawayStrip() {
  const t = useT();
  const lp = useLp();
  const path = usePathname() ?? '/';
  if (!GIVEAWAY_PUBLIC || hasClosed() || HIDDEN.some((re) => re.test(path))) return null;
  return (
    <Link
      href={lp('/giveaway')}
      data-umami-event="giveaway_banner"
      data-umami-event-from="strip"
      className="block bg-gradient-to-r from-[#5a3fd1] via-[#7b4dff] to-[#5a3fd1] px-4 py-2 text-center text-sm font-semibold text-white hover:brightness-110"
    >
      🎁 {t('Win the Brawl Pass: free giveaway, more points = more chances.')}{' '}
      <span className="font-bold text-brand underline">{t('Enter now')}</span>
    </Link>
  );
}
