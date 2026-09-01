import { getBrawlers } from '@/lib/brawlapi';
import { getWikiBrawlerClasses } from '@/lib/brawler-classes';
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
        className: realValue(meta?.class?.name),
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
  const unclassified = all.filter((b) => b.className === null).map((b) => b.name);
  if (unclassified.length > 0) {
    const wikiClasses = new Map(
      await getWikiBrawlerClasses(unclassified).catch(() => [] as [string, string][]),
    );
    for (const brawler of all) {
      if (brawler.className === null) {
        brawler.className = wikiClasses.get(brawler.name.toLowerCase()) ?? null;
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
