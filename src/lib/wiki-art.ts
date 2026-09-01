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
function spellings(name: string): string[] {
  const cased = new Set([titleCase(name), name]);
  const forms = new Set<string>();
  for (const base of cased) {
    forms.add(base);
    forms.add(base.replace(/\.\s+/g, '.'));
    forms.add(base.replace(/\s+/g, ''));
  }
  return [...forms];
}

function candidates(name: string): string[] {
  return spellings(name).map((f) => `${f} Portrait`);
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

/**
 * Gadget and star power icons, in the order the wiki numbers them.
 *
 * Filed as "GD-<Name>1.png" and "SP-<Name>1.png", which is a different
 * spelling of the name from the portrait's: Mr. P keeps the space in
 * "Mr. P Portrait.png" and loses it in "GD-Mr.P1.png". Both are tried.
 *
 * Ordered, because that is what lets an icon be paired with an ability the
 * game API named: the API lists gadgets and star powers in the same order the
 * wiki numbers them, and neither carries the other's label.
 */
async function abilityIcons(prefix: string): Promise<string[]> {
  try {
    const url = new URL(WIKI_API);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'allimages');
    url.searchParams.set('aiprefix', prefix);
    url.searchParams.set('ailimit', '8');
    url.searchParams.set('aiprop', 'url');
    url.searchParams.set('format', 'json');
    const res = await fetch(url, {
      headers: { 'user-agent': 'BrawlZone (+https://brawlzone.net)' },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { query?: { allimages?: { name: string; url: string }[] } };
    return (body.query?.allimages ?? [])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((i) => i.url);
  } catch {
    return [];
  }
}

async function fetchAbilityArt(name: string): Promise<{ gadgets: string[]; starPowers: string[] }> {
  const forms = [...new Set([titleCase(name), name])].flatMap((n) => [n, n.replace(/\.\s+/g, '.')]);
  for (const form of forms) {
    const [gadgets, starPowers] = await Promise.all([
      abilityIcons(`GD-${form}`),
      abilityIcons(`SP-${form}`),
    ]);
    if (gadgets.length > 0 || starPowers.length > 0) return { gadgets, starPowers };
  }
  return { gadgets: [], starPowers: [] };
}

/** Ability icons for one brawler, for when the mirror has none. */
export const getWikiAbilityArt = cached('wiki-ability-art', fetchAbilityArt, REVALIDATE);

/**
 * The full-body character render, for the detail page's header.
 *
 * The header spends the full content width on the brawler, and the square
 * portrait tile is the fallback for when there is no render — which is how a
 * brand-new brawler looked beside every released one: a 144px crop where the
 * rest of the roster gets a character. Brawlify publishes `/model/` weeks
 * behind a release, so the gap this closes is the same one the portrait
 * fallback exists for, and it is wider than the portrait's.
 *
 * The wiki files it as "<Name> Skin-Default.png" — the default skin's render,
 * a convention that holds across every awkward name checked (`Mr. P`,
 * `8-Bit`, `Larry & Lawrie`, `El Primo`). Requested through MediaWiki's
 * scaler rather than raw: the originals run 2-4 MB, which is fine as a wiki
 * download and absurd behind a 208px-wide `<img>`. The scaler never upscales,
 * so a small original comes back untouched.
 *
 * Every spelling goes in one request as pipe-separated titles; a title that
 * does not exist comes back flagged missing with no `imageinfo`, so the first
 * page that carries one is the answer.
 */
const MODEL_WIDTH = 640;

async function fetchModel(name: string): Promise<string | null> {
  try {
    const url = new URL(WIKI_API);
    url.searchParams.set('action', 'query');
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set(
      'titles',
      spellings(name)
        .map((f) => `File:${f} Skin-Default.png`)
        .join('|'),
    );
    url.searchParams.set('iiprop', 'url');
    url.searchParams.set('iiurlwidth', String(MODEL_WIDTH));
    url.searchParams.set('format', 'json');
    const res = await fetch(url, {
      headers: { 'user-agent': 'BrawlZone (+https://brawlzone.net)' },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      query?: { pages?: Record<string, { imageinfo?: { url?: string; thumburl?: string }[] }> };
    };
    for (const page of Object.values(body.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (info) return info.thumburl ?? info.url ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Full-body render for one brawler, for when the mirror has none. */
export const getWikiModel = cached('wiki-model', fetchModel, REVALIDATE);
