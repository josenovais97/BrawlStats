import { getBrawlers } from '@/lib/brawlapi';
import { slugify } from '@/lib/slugs';
import type { BABrawler } from '@/types/brawlapi';

/**
 * The `/compare/[pair]` path segment, e.g. "shelly-vs-colt".
 *
 * One segment rather than two, because a comparison is one page about one
 * pairing — `/compare/shelly/colt` would read as a page about Colt filed under
 * Shelly, and would need its own redirect story for the reversed order.
 *
 * Brawler names slug to unique strings today ("8-Bit" and "Mr. P" included),
 * so a name is the identifier rather than the numeric id: `shelly-vs-colt` is
 * a URL someone can type, and `16000000-vs-16000001` is not.
 */
export const PAIR_SEPARATOR = '-vs-';

export function comparePath(a: BABrawler, b: BABrawler): string {
  return `/compare/${slugify(a.name)}${PAIR_SEPARATOR}${slugify(b.name)}`;
}

export interface ComparePair {
  a: BABrawler;
  b: BABrawler;
  /** The canonical slug pair, for redirecting a differently-cased URL. */
  slug: string;
}

/**
 * Resolves a pair segment against the brawler list.
 *
 * Returns null for anything that does not name two distinct brawlers, which
 * the route turns into a 404 — a comparison of a brawler with itself is not a
 * page, and neither is one naming something that does not exist.
 */
export async function resolvePair(segment: string): Promise<ComparePair | null> {
  const parts = segment.split(PAIR_SEPARATOR);
  if (parts.length !== 2) return null;

  const brawlers = await getBrawlers().catch(() => [] as BABrawler[]);
  const bySlug = new Map(brawlers.map((brawler) => [slugify(brawler.name), brawler]));

  const a = bySlug.get(slugify(parts[0]));
  const b = bySlug.get(slugify(parts[1]));
  if (!a || !b || a.id === b.id) return null;

  return { a, b, slug: `${slugify(a.name)}${PAIR_SEPARATOR}${slugify(b.name)}` };
}
