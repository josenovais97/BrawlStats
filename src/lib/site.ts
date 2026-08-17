/**
 * Canonical origin for the deployed site.
 *
 * Metadata needs absolute URLs for canonical links, Open Graph and structured
 * data. Preview deploys get their own hostname from Vercel, but the canonical
 * URL should still point at production, so the production origin wins whenever
 * it is set.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://brawlzone.vercel.app'
).replace(/\/$/, '');

export const SITE_NAME = 'BrawlZone';
