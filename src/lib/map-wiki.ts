import { slugify } from '@/lib/slugs';
import {
  WIKI_API,
  fetchWikiJson,
  firstPage,
  parseInfobox,
  sectionBody,
  toPlainText,
  type WikiPagesResponse,
} from '@/lib/wiki';

/**
 * What the wiki knows about a map.
 *
 * Map pages are the site's largest indexable surface — one per active map —
 * and until now each said little beyond its mode and a ranking. The wiki has a
 * page per map with a real layout description, which is the substance those
 * pages were missing.
 *
 * It also has the environment under its display name. The artwork mirror
 * carries an internal asset id there instead ("Katanakingdomnn2" for what the
 * game calls Katana Kingdom), which is why the environment chip was dropped
 * from the map page earlier; this puts it back with a name worth reading.
 */

/** Layouts change only when a map is reworked. */
const REVALIDATE_MAP_WIKI = 86_400;

export interface MapWiki {
  /** Wiki page title, for attribution links. */
  title: string;
  /** Display name of the environment, e.g. "Katana Kingdom". */
  environment: string | null;
  /** The opening sentence(s) of the page. */
  intro: string | null;
  /** The Layout section: how the map actually plays. */
  layout: string | null;
}

/** Terrain-count and event fields we deliberately ignore, kept for clarity. */
const INFOBOX_ENVIRONMENT = 'Environment';

/**
 * Fetches one map page, falling back to the wiki's own search.
 *
 * The two catalogues punctuate differently — the artwork mirror calls a map
 * "Belles Rock" where the wiki titles it "Belle's Rock" — so an exact-title
 * lookup misses a handful of maps outright. `generator=search` resolves those
 * in the same request shape, and the result is only accepted when its title
 * slugs to the name we asked for, so a near-miss cannot silently attach the
 * wrong map's description.
 */
async function fetchMapPage(name: string) {
  const direct = await fetchWikiJson<WikiPagesResponse>(
    `${WIKI_API}?action=query&prop=revisions&rvslots=main&rvprop=content` +
      `&format=json&redirects=1&titles=${encodeURIComponent(name)}`,
    REVALIDATE_MAP_WIKI,
  );

  const page = firstPage(direct);
  if (page) return page;

  const searched = await fetchWikiJson<WikiPagesResponse>(
    `${WIKI_API}?action=query&generator=search&gsrlimit=1` +
      `&gsrsearch=${encodeURIComponent(name)}&prop=revisions&rvslots=main` +
      `&rvprop=content&format=json`,
    REVALIDATE_MAP_WIKI,
  );

  const hit = firstPage(searched);
  // Search will happily return the closest article for a name that has no page
  // at all, so the title has to actually match.
  return hit && slugify(hit.title) === slugify(name) ? hit : null;
}

export async function getMapWiki(name: string, mode?: string): Promise<MapWiki | null> {
  const page = await fetchMapPage(name);
  if (!page) return null;

  const box = parseInfobox(page.wikitext, 'Map Infobox');

  /*
   * Map names repeat across modes, and so do wiki pages: a page found for
   * "Double Trouble" may describe the Brawl Ball one when we wanted Knockout.
   * The infobox names its event, so a mismatch is dropped rather than shown
   * against the wrong map.
   */
  const event = box.Event ? toPlainText(box.Event) : null;
  if (mode && event && slugify(event) !== slugify(mode)) return null;

  const layoutSection = sectionBody(page.wikitext, 'Layout');
  const layout = layoutSection ? toPlainText(layoutSection) : null;

  // Everything above the first heading, minus the templates that open a page.
  const head = page.wikitext.split(/\n==/)[0];
  const intro = toPlainText(head.replace(/^\s*(\{\{[^{}]*\}\}\s*)+/, ''));

  if (!layout && !intro) return null;

  return {
    title: page.title,
    environment: box[INFOBOX_ENVIRONMENT]
      ? toPlainText(box[INFOBOX_ENVIRONMENT])
      : null,
    intro: intro || null,
    layout,
  };
}
