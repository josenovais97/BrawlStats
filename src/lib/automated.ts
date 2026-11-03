/**
 * Whether this browser is a crawler or an automated one (2026-11-03).
 *
 * They take full-page snapshots without scrolling, so anything that waits to
 * be scrolled into view -- the entrance animations, the counters, the home
 * podium -- stayed hidden, at zero or in silhouette, and the page read as
 * blank: the snapshot an AdSense review or Google's page preview looks at.
 * Those effects skip themselves here and leave the finished page.
 *
 * Google's crawlers and renderers by name, not a loose "bot" (CUBOT is a
 * phone), plus `navigator.webdriver` for headless tools.
 */
const BOTS =
  /Googlebot|Google-InspectionTool|Mediapartners-Google|AdsBot-Google|Storebot-Google|Google-PageRenderer|Chrome-Lighthouse|HeadlessChrome|bingbot|Applebot|YandexBot|DuckDuckBot/i;

export function isAutomated(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.webdriver === true || BOTS.test(navigator.userAgent);
}
