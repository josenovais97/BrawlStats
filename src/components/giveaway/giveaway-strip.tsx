'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

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
/** The X hides it on this browser for a week (owner, 2026-10-28). */
const DISMISS_KEY = 'bz-giveaway-strip';
const WEEK = 7 * 86_400_000;

// Also not where the page has its own giveaway banner (2026-10-30): on the
// home page and /rewards the strip stacked on top of a better one, which got
// 51 and 126 clicks in three days against the strip's 37 and 36 closes.
const HIDDEN = [
  /^\/(?:es\/|pt\/)?bubble\/(?:panel|test)/,
  /^\/(?:es\/|pt\/)?giveaway/,
  /^\/(?:es|pt)?\/?$/,
  /^\/(?:es\/|pt\/)?rewards\/?$/,
];

export function GiveawayStrip() {
  const t = useT();
  const lp = useLp();
  const path = usePathname() ?? '/';
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the choice lives in this browser only
      setDismissed(Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < WEEK);
    } catch {
      // Storage blocked: the strip stays, and the X still hides it for this page view.
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // As above.
    }
    setDismissed(true);
  }

  if (dismissed || !GIVEAWAY_PUBLIC || hasClosed() || HIDDEN.some((re) => re.test(path))) return null;
  return (
    <div className="relative bg-gradient-to-r from-[#5a3fd1] via-[#7b4dff] to-[#5a3fd1] text-white">
      <Link
        href={lp('/giveaway')}
        data-umami-event="giveaway_banner"
        data-umami-event-from="strip"
        className="block py-2 pl-4 pr-11 text-center text-sm font-semibold hover:brightness-110"
      >
        🎁 {t('Win the Brawl Pass: free giveaway, more points = more chances.')}{' '}
        <span className="font-bold text-brand underline">{t('Enter now')}</span>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('Close')}
        data-umami-event="giveaway_strip_close"
        className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-white/80 hover:bg-white/15 hover:text-white"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
