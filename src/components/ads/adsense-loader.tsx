'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

/** Google AdSense publisher id (not a secret: it is in every served page and in ads.txt). */
export const ADSENSE_CLIENT = 'ca-pub-9381565116085110';

/**
 * Pages that never load ad code (2026-10-19).
 *
 * The Bubble panel is shown inside the Android app, over a game, and the
 * Google Play listing declares "no ads" -- the app must stay ad-free. The
 * tester page is part of that app's launch. Matched with or without a
 * language prefix.
 */
const AD_FREE = [/^\/(?:es\/|pt\/)?bubble\/panel/, /^\/(?:es\/|pt\/)?bubble\/test/];

/**
 * Loads Google's ad script on every other page. AdSense's own consent
 * message (Privacy & messaging, configured in the AdSense account) comes with
 * the same script, so visitors in the EEA, UK and Switzerland are asked
 * before anything personalised is shown.
 */
export function AdsenseLoader() {
  const path = usePathname() ?? '/';
  if (process.env.NODE_ENV !== 'production') return null;
  if (AD_FREE.some((re) => re.test(path))) return null;
  return (
    <Script
      id="adsense"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
