import 'server-only';

import { unstable_cache } from 'next/cache';

import { WIKI_API } from '@/lib/wiki';

/**
 * Artwork for skins, which no API this project uses will give you.
 *
 * Checked 2026-08-28: `api.brawlapi.com` has no `/v1/skins` endpoint and its
 * brawler records carry no `skins` key; every `cdn.brawlify.com/skins/...`
 * path 404s; `api.brawlify.com` returns 403. The wiki is the only reachable
 * source, and it files skin art under a predictable name —
 * `Shelly_Skin-Cyber.png` — which `list=allimages` will enumerate in bulk.
 *
 * Fetched as one sweep rather than a lookup per skin: the catalogue needs
 * ~1,200 of these and a call each would be absurd. One paginated sweep builds
 * the whole map, and it is cached for a day because skin art changes when a
 * skin is released, not continuously.
 *
 * Fails to an empty map. Every caller renders without artwork rather than
 * breaking, which is the same bargain the rest of the wiki reads make: an
 * unreachable wiki costs a picture, never a page.
 */

/** How the wiki names a skin file, once the extension is gone. */
const SKIN_FILE = /^(.+?)_Skin-(.+)$/;

/**
 * Collapses the many spellings of one name to a single key.
 *
 * The wiki is inconsistent in ways that all mean the same skin: underscores or
 * spaces, trailing `-0` on re-uploads, and sometimes the brawler's name
 * repeated inside the variant (`Shelly_Skin-Bandita_Shelly`).
 */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.(png|jpg|jpeg|webp)$/i, '')
    .replace(/[_\-\s]+/g, ' ')
    .replace(/\s+\d+$/, '')
    .trim();
}

/** The variant, with the brawler's own name stripped from either end. */
function variantKey(brawler: string, raw: string): string {
  const b = normalise(brawler);
  let v = normalise(raw);
  if (v.startsWith(`${b} `)) v = v.slice(b.length + 1);
  if (v.endsWith(` ${b}`)) v = v.slice(0, -(b.length + 1));
  return v.trim();
}

async function fetchSkinArt(): Promise<Record<string, string>> {
  const art: Record<string, string> = {};
  let cont: string | undefined;

  try {
    // Bounded: the wiki holds a few thousand images and the loop stops on the
    // first page without a continuation. The cap is a guard against a
    // continuation token that never terminates, not an expected limit.
    for (let page = 0; page < 40; page += 1) {
      const url = new URL(WIKI_API);
      url.searchParams.set('action', 'query');
      url.searchParams.set('list', 'allimages');
      url.searchParams.set('ailimit', '500');
      url.searchParams.set('aiprop', 'url');
      url.searchParams.set('format', 'json');
      if (cont) url.searchParams.set('aicontinue', cont);

      const res = await fetch(url, {
        headers: { 'user-agent': 'BrawlZone (+https://brawlzone.net)' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) break;

      const body = (await res.json()) as {
        query?: { allimages?: { name: string; url: string }[] };
        continue?: { aicontinue?: string };
      };

      for (const image of body.query?.allimages ?? []) {
        const match = SKIN_FILE.exec(image.name.replace(/\.(png|jpg|jpeg|webp)$/i, ''));
        if (!match) continue;
        const [, brawler, variant] = match;
        const key = `${normalise(brawler)}|${variantKey(brawler, variant)}`;
        // First write wins: the sweep returns names alphabetically, so
        // `Bandita` lands before `Bandita_Shelly` and the cleaner file is kept.
        if (!art[key]) art[key] = image.url;
      }

      cont = body.continue?.aicontinue;
      if (!cont) break;
    }
  } catch {
    // An unreachable wiki costs the pictures, never the page.
    return art;
  }

  return art;
}

/** The whole skin-art map, cached for a day. */
export const getSkinArt = unstable_cache(fetchSkinArt, ['skin-art'], {
  revalidate: 86_400,
});

/**
 * The artwork for one skin, or null when the wiki has no file for it.
 *
 * `skinName` is the game's own label ("CYBER SHELLY"), which carries the
 * brawler's name; the wiki's variant does not. Stripping it is what makes the
 * two agree.
 */
export function skinArtUrl(
  art: Record<string, string>,
  brawlerName: string,
  skinName: string,
): string | null {
  const key = `${normalise(brawlerName)}|${variantKey(brawlerName, skinName)}`;
  return art[key] ?? null;
}
