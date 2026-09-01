import 'server-only';

import { cached } from '@/lib/cached';
import { titleCase } from '@/lib/format';
import { WIKI_API } from '@/lib/wiki';

/**
 * Portraits for brawlers the artwork mirror does not have yet.
 *
 * Brawlify's URLs are constructed from a brawler id, so a brawler it has not
 * added yet does not fall back — it 404s. Verified: a fabricated id returns
 * 404 while a real one returns 200.
 *
 * That matters for exactly one day per release, and it is the worst possible
 * day. The moment the game API lists a new brawler it enters the catalogue,
 * the site stops serving the preview page and starts serving the full one, and
 * the portrait becomes a constructed Brawlify URL. If the mirror has not
 * caught up, the highest-traffic page of the month renders with a broken
 * image.
 *
 * The wiki has the art from the reveal, weeks earlier, so it covers precisely
 * the window Brawlify lags in. This is not a migration away from Brawlify —
 * measured, the mirror has all 107 released brawlers, and its filenames are a
 * stable CDN contract where the wiki's are community-editable. It is a
 * fallback for the gap between "the game has it" and "the mirror has it".
 */

/** Art changes on release and then sits still. */
const REVALIDATE = 86_400;

/**
 * The wiki files a portrait as "<Name> Portrait.png", and the casing has to
 * match: MediaWiki's prefix search is case-sensitive past the first letter.
 *
 * That is not a hypothetical. The official game API returns names shouted —
 * "COSMO", "VINCE" — and a brawler with no artwork-mirror entry takes its name
 * from there, which is exactly the case this fallback exists for. Searching
 * "COSMO Portrait" against a file called "Cosmo Portrait.png" found nothing,
 * so the fallback silently did nothing on the one day it was written for.
 *
 * Punctuation is inconsistent on the wiki's side too: Mr. P's portrait keeps
 * the space in his name while his ability icons drop it. Every spelling is
 * tried rather than any one assumed.
 */
function candidates(name: string): string[] {
  const cased = new Set([titleCase(name), name]);
  const forms = new Set<string>();
  for (const base of cased) {
    forms.add(base);
    forms.add(base.replace(/\.\s+/g, '.'));
    forms.add(base.replace(/\s+/g, ''));
  }
  return [...forms].map((f) => `${f} Portrait`);
}

async function lookup(prefix: string): Promise<string | null> {
  try {
    const url = new URL(WIKI_API);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'allimages');
    url.searchParams.set('aiprefix', prefix);
    url.searchParams.set('ailimit', '3');
    url.searchParams.set('aiprop', 'url');
    url.searchParams.set('format', 'json');
    const res = await fetch(url, {
      headers: { 'user-agent': 'BrawlZone (+https://brawlzone.net)' },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { query?: { allimages?: { url: string }[] } };
    return body.query?.allimages?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

async function fetchPortraits(names: string[]): Promise<[string, string][]> {
  if (names.length === 0) return [];
  const found = await Promise.all(
    names.map(async (name): Promise<[string, string] | null> => {
      for (const prefix of candidates(name)) {
        const url = await lookup(prefix);
        if (url) return [name.toLowerCase(), url];
      }
      return null;
    }),
  );
  return found.filter((e): e is [string, string] => e !== null);
}

/** Keyed by lowercased name. Empty when the wiki is unreachable. */
export const getWikiPortraits = cached('wiki-portraits', fetchPortraits, REVALIDATE);
