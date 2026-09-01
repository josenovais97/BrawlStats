import {
  getBrawlerMap,
  getBrawlers,
  hasBrawlerPortrait,
  realBrawlerClass,
} from '@/lib/brawlapi';
import { getWikiBrawlerFacts } from '@/lib/brawler-classes';
import { getWikiPortraits } from '@/lib/wiki-art';
import { getOfficialBrawlers } from '@/lib/bs-api';
import { slugify } from '@/lib/slugs';
import type { BABrawler } from '@/types/brawlapi';

/**
 * The one canonical answer to "which brawlers exist, and which count".
 *
 * Two sources disagree, and the disagreement is meaningful rather than a bug:
 *
 * - The official API's catalogue is the set the game currently offers. It is
 *   the authority on what is playable, and therefore on every count and every
 *   pick list.
 * - The artwork mirror lists one more (107 against 106) because it keeps
 *   brawlers that have been withdrawn — Buzz Lightyear, a time-limited collab.
 *   That extra entry is why it must never be counted, and why its artwork must
 *   still be available: the brawler is gone, the battles people played with it
 *   are not.
 *
 * Before this existed, different pages picked whichever source was convenient:
 * account completion used the official 106, the draft helper and the compare
 * picker used the artwork mirror's 107 and offered a brawler nobody can play.
 * Everything now derives from here, so the counts cannot drift apart.
 */

export type BrawlerStatus = 'current' | 'legacy';

export interface CatalogBrawler {
  id: number;
  /** Display name, from the artwork source where available. */
  name: string;
  status: BrawlerStatus;
  /** Artwork and rarity. Absent only if the mirror is unreachable. */
  meta: BABrawler | undefined;
  /**
   * A portrait that actually resolves.
   *
   * Brawlify's URLs are built from an id, so a brawler it has not added yet
   * 404s rather than falling back. That happens for one day per release — the
   * day the game API lists a new brawler and the site switches from the
   * preview page to the full one — and it is the day that page gets the most
   * traffic it ever will. The wiki has the art from the reveal, so it covers
   * exactly the gap between "the game has it" and "the mirror has it".
   */
  imageUrl: string;
  /**
   * Class name, or null when no source knows it.
   *
   * The artwork mirror reports "Unknown" for every brawler released since
   * Meeple — twenty of them at the time of writing — and rendering that
   * verbatim put a chip reading "Unknown" on a fifth of the roster. Null means
   * "no source knows", and callers omit the field rather than showing a
   * placeholder.
   */
  className: string | null;
  /** Rarity name, same treatment as `className`. */
  rarityName: string | null;
  rarityColor: string | null;
}

export interface BrawlerCatalog {
  all: CatalogBrawler[];
  /** Playable today. The denominator for every count and completion figure. */
  current: CatalogBrawler[];
  /** Withdrawn, but preserved so historical battles still render. */
  legacy: CatalogBrawler[];
  byId: Map<number, CatalogBrawler>;
  /**
   * Keyed by slugged name, which is what the brawler page is addressed by.
   *
   * `/brawlers/brock` rather than `/brawlers/16000003`: the id says nothing to
   * a reader or to a search engine, and every competitor for "brock build"
   * carries the name in the path.
   */
  bySlug: Map<string, CatalogBrawler>;
}

/** "Unknown" is a placeholder upstream, not a value. */
function realValue(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'unknown' ? trimmed : null;
}

/**
 * The artwork source ships at least one malformed colour ("#fff11ev"), and an
 * invalid value inside `color-mix()` drops the whole declaration.
 */
function realColor(value: string | undefined | null): string | null {
  return value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : null;
}

export async function getBrawlerCatalog(): Promise<BrawlerCatalog> {
  const [official, artwork] = await Promise.all([
    getOfficialBrawlers()
      .then((r) => r.items)
      .catch(() => []),
    getBrawlers().catch(() => [] as BABrawler[]),
  ]);

  const playable = new Set(official.map((b) => b.id));
  const metaById = new Map(artwork.map((b) => [b.id, b]));

  // Union of both sources: the official list decides status, the mirror
  // supplies presentation, and either one being unavailable degrades to the
  // other rather than to an empty roster.
  const ids = new Set<number>([...playable, ...metaById.keys()]);

  const all: CatalogBrawler[] = [...ids]
    .map((id) => {
      const meta = metaById.get(id);
      const officialEntry = official.find((b) => b.id === id);
      return {
        id,
        name: meta?.name ?? officialEntry?.name ?? `#${id}`,
        // With no official list at all, nothing can be called withdrawn —
        // treating the whole roster as legacy would be far worse than
        // treating one withdrawn brawler as current.
        status: (playable.size === 0 || playable.has(id)
          ? 'current'
          : 'legacy') as BrawlerStatus,
        meta,
        // Overwritten below when the mirror has nothing and the wiki does.
        imageUrl: meta?.imageUrl ?? `https://cdn.brawlify.com/brawlers/borders/${id}.png`,
        className: realBrawlerClass(meta?.class?.name),
        rarityName: realValue(meta?.rarity?.name),
        rarityColor: realColor(meta?.rarity?.color),
      };
    })
    .sort((a, b) => a.id - b.id);

  /*
   * Fill the classes the mirror does not know from the wiki.
   *
   * In place, after the list is built, so the lookup runs once for the whole
   * roster rather than per brawler — and only for the names actually missing
   * one, which is twenty rather than a hundred and seven. A failure here
   * leaves the field null, which is exactly the state this is improving on.
   */
  /*
   * Portraits for anything the mirror has not caught up with.
   *
   * Keyed on whether the image *resolves*, not on whether the payload carries a
   * URL. Those are not the same question: the mirror publishes a brawler's
   * metadata before its artwork, so on 2026-09-01 Cosmo and Vince arrived with
   * constructed `imageUrl`s that 404. The earlier test — "the mirror has no
   * entry" — passed the moment the entry landed, which switched the fallback
   * off and left two broken images on the roster page. A URL is not evidence of
   * a file.
   *
   * One HEAD per brawler, memoised in-process for a day and answered from cache
   * on every later call, so a warm catalogue build asks nothing. Bounded
   * concurrency because it is the whole roster: unbounded, it is 109 sockets
   * opened at once for a question that is almost always "yes".
   */
  const missingArt: string[] = [];
  const CONCURRENCY = 12;
  for (let i = 0; i < all.length; i += CONCURRENCY) {
    const batch = all.slice(i, i + CONCURRENCY);
    const present = await Promise.all(
      batch.map((b) => (b.meta?.imageUrl ? hasBrawlerPortrait(b.id) : Promise.resolve(false))),
    );
    batch.forEach((b, j) => {
      if (!present[j]) missingArt.push(b.name);
    });
  }

  if (missingArt.length > 0) {
    const portraits = new Map(
      await getWikiPortraits(missingArt).catch(() => [] as [string, string][]),
    );
    const wanted = new Set(missingArt);
    for (const brawler of all) {
      if (!wanted.has(brawler.name)) continue;
      brawler.imageUrl = portraits.get(brawler.name.toLowerCase()) ?? brawler.imageUrl;
    }
  }

  const unclassified = all
    .filter((b) => b.className === null || b.rarityName === null)
    .map((b) => b.name);
  if (unclassified.length > 0) {
    const facts = new Map(await getWikiBrawlerFacts(unclassified).catch(() => []));

    /*
     * Rarity colours are borrowed from a brawler that already has one, rather
     * than hardcoded here. The mirror owns that palette, so copying a peer of
     * the same rarity keeps a wiki-sourced brawler tinted exactly like every
     * other Mythic instead of falling back to the neutral grey — which is what
     * left the two newest brawlers with a grey pill and a grey card border.
     */
    const colourByRarity = new Map<string, string>();
    for (const b of all) {
      if (b.rarityName && b.rarityColor && !colourByRarity.has(b.rarityName)) {
        colourByRarity.set(b.rarityName, b.rarityColor);
      }
    }

    for (const brawler of all) {
      const found = facts.get(brawler.name.toLowerCase());
      if (!found) continue;
      brawler.className ??= found.className;
      if (brawler.rarityName === null && found.rarityName) {
        brawler.rarityName = found.rarityName;
        brawler.rarityColor = colourByRarity.get(found.rarityName) ?? brawler.rarityColor;
      }
    }
  }

  return {
    all,
    current: all.filter((b) => b.status === 'current'),
    legacy: all.filter((b) => b.status === 'legacy'),
    byId: new Map(all.map((b) => [b.id, b])),
    // Later entries win on a slug collision, which cannot happen with the
    // current roster and would resolve to the newer brawler if it ever did.
    bySlug: new Map(all.map((b) => [slugify(b.name), b])),
  };
}

/**
 * Counts, from one derivation.
 *
 * Exists so a page never computes its own: the homepage headline, the
 * catalogue total, the completion denominator and the draft pool are the same
 * number by construction rather than by four components agreeing.
 */
export async function getBrawlerCounts(): Promise<{
  current: number;
  legacy: number;
  total: number;
}> {
  const catalog = await getBrawlerCatalog();
  return {
    current: catalog.current.length,
    legacy: catalog.legacy.length,
    total: catalog.all.length,
  };
}

/**
 * The artwork map, with the mirror's gaps filled from the catalogue.
 *
 * Every list on the site draws its icons as `meta?.imageUrl ?? brawlerIconUrl(id)`,
 * and that fallback is the one thing it cannot be: Brawlify builds its URLs
 * from an id, so a brawler it has not added yet 404s instead of degrading.
 * The result is a broken square wherever a brand-new brawler appears — a
 * player's profile, their battle log — for the days between the game listing
 * the brawler and the mirror catching up.
 *
 * That is the same gap `getWikiPortraits` already closes for the catalogue, so
 * this hands the rest of the site the catalogue's answer rather than making
 * each caller repeat it. Callers still see a `Map<number, BABrawler>` and the
 * `?? brawlerIconUrl(id)` fallbacks stay where they are; they simply stop
 * being reached.
 *
 * A synthesised entry carries artwork and identity only. Anything reading
 * richer fields off the mirror still finds them missing, which is correct —
 * the mirror genuinely has nothing to say about this brawler yet.
 */
export async function getBrawlerArtMap(): Promise<Map<number, BABrawler>> {
  const [map, catalogue] = await Promise.all([
    getBrawlerMap().catch(() => new Map<number, BABrawler>()),
    getBrawlerCatalog().catch(() => null),
  ]);

  for (const entry of catalogue?.all ?? []) {
    if (map.has(entry.id) || !entry.imageUrl) continue;
    map.set(entry.id, {
      id: entry.id,
      name: entry.name,
      imageUrl: entry.imageUrl,
      imageUrl2: entry.imageUrl,
      imageUrl3: entry.imageUrl,
      class: { id: 0, name: entry.className ?? '' },
      rarity: { id: 0, name: entry.rarityName ?? '', color: entry.rarityColor ?? '#8b95b8' },
      description: '',
      descriptionHtml: '',
      starPowers: [],
      gadgets: [],
      released: true,
    } as unknown as BABrawler);
  }

  return map;
}
