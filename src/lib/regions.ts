/**
 * Regions the official rankings endpoint accepts.
 *
 * The API takes "global" or an ISO 3166-1 alpha-2 country code. It exposes a
 * /locations endpoint listing every valid code, but that list is long and
 * mostly empty leaderboards, so the UI offers a curated set of regions with
 * large player bases while the route validator accepts any well-formed code.
 */

export interface Region {
  code: string;
  name: string;
}

export const FEATURED_REGIONS: Region[] = [
  { code: 'global', name: 'Global' },
  { code: 'us', name: 'United States' },
  { code: 'br', name: 'Brazil' },
  { code: 'mx', name: 'Mexico' },
  { code: 'de', name: 'Germany' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'fr', name: 'France' },
  { code: 'es', name: 'Spain' },
  { code: 'it', name: 'Italy' },
  { code: 'pl', name: 'Poland' },
  { code: 'ru', name: 'Russia' },
  { code: 'tr', name: 'Turkey' },
  { code: 'kr', name: 'South Korea' },
  { code: 'jp', name: 'Japan' },
  { code: 'cn', name: 'China' },
  { code: 'id', name: 'Indonesia' },
  { code: 'in', name: 'India' },
  { code: 'ph', name: 'Philippines' },
  { code: 'th', name: 'Thailand' },
  { code: 'vn', name: 'Vietnam' },
  { code: 'ca', name: 'Canada' },
  { code: 'au', name: 'Australia' },
];

/** "global" or any two-letter code — the API decides whether data exists. */
export function isSupportedRegion(code: string): boolean {
  const c = code.toLowerCase();
  return c === 'global' || /^[a-z]{2}$/.test(c);
}

export function regionName(code: string): string {
  const match = FEATURED_REGIONS.find((r) => r.code === code.toLowerCase());
  return match?.name ?? code.toUpperCase();
}
