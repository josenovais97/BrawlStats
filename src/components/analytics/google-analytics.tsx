'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

/** GA4 measurement id (not a secret: it is in every served page). */
const MEASUREMENT_ID = 'G-EQEN36TD7L';

/**
 * Google tag gateway (2026-11-12): Cloudflare serves the tag from our own
 * domain at this path and forwards measurement to Google, so content
 * blockers that drop googletagmanager.com no longer hide the visit (Umami
 * counted about twice GA's Tier-1 visitors). Set up from GA's Google tag
 * settings with Cloudflare; read back with
 * GET /zones/<id>/settings/google-tag-gateway/config (needs Zaraz Read).
 * Automatic tag setup stays off there: consent mode is set here first.
 */
const GATEWAY_PATH = '/rwwq';

/**
 * Same pages as the ads leave out: the Bubble panel runs inside the Android
 * app, whose Play listing and privacy section say it carries no analytics
 * SDK and shares nothing with third parties.
 */
const NO_THIRD_PARTY = [/^\/(?:es\/|pt\/)?bubble\/panel/, /^\/(?:es\/|pt\/)?bubble\/test/];

/** Where consent is asked first: the EEA, the UK and Switzerland, as the ads' message does. */
const CONSENT_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT',
  'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH',
];

/**
 * Google Analytics, added 2026-10-29 for ad networks that judge a site by it
 * (Journey by Mediavine reads traffic from Google Analytics). Umami stays the
 * site's own counter.
 *
 * Consent mode: denied by default in the regions above until Google's consent
 * message, which the AdSense script brings, records a choice. Elsewhere it
 * runs as normal. The queue is written before gtag.js loads, so the default
 * always precedes the config whichever script arrives first. Page views on
 * client-side navigation come from GA's own history tracking.
 */
export function GoogleAnalytics() {
  const path = usePathname() ?? '/';
  if (process.env.NODE_ENV !== 'production') return null;
  if (NO_THIRD_PARTY.some((re) => re.test(path))) return null;
  return (
    <>
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',region:${JSON.stringify(CONSENT_REGIONS)},wait_for_update:500});
gtag('js',new Date());gtag('config','${MEASUREMENT_ID}');`}
      </Script>
      <Script
        id="ga"
        src={`${GATEWAY_PATH}/?id=${MEASUREMENT_ID}`}
        strategy="afterInteractive"
        onError={() => {
          // The gateway answers from Cloudflare, before the origin; if it is
          // ever switched off, /rwwq/ falls through to a 404 and analytics
          // would stop silently. Load the tag from Google instead.
          const s = document.createElement('script');
          s.async = true;
          s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
          document.head.appendChild(s);
        }}
      />
    </>
  );
}
