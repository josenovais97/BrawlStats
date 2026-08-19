/**
 * URL slugs for the things the game names rather than numbers: game modes and
 * maps.
 *
 * These exist so search-intent pages can live at readable paths —
 * `/maps/gem-grab/hard-rock-mine` rather than a query string — which is the
 * whole point of splitting them out of `?mode=`: a query parameter is one URL
 * to a crawler no matter how many values it takes.
 *
 * Slugging is lossy (punctuation and case are dropped), so nothing round-trips
 * a slug back into a display name. Every route resolves a slug by matching it
 * against the real names it already has in hand.
 */

/** "Hard Rock Mine" -> "hard-rock-mine", "gemGrab" -> "gem-grab". */
export function slugify(value: string): string {
  return (
    value
      // Split camelCase before lowercasing, so API mode ids slug the same way
      // the display labels do.
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase()
      // Strip accents, which map names use freely ("Café", "Böse").
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      /*
       * Apostrophes are dropped, not turned into a separator.
       *
       * Sources disagree on them for the same name — the artwork mirror calls
       * a map "Belles Rock" and the wiki calls it "Belle's Rock" — and a
       * separator makes those slug differently ("belles-rock" versus
       * "belle-s-rock"), so a name that matches to a reader fails to match
       * here. Removing the character makes both sides agree, and no name in
       * either catalogue relies on one to stay distinct.
       */
      .replace(/['\u2019]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

/**
 * Finds the item whose name slugs to `slug`.
 *
 * Used by every `[slug]` route, because the reverse direction does not exist:
 * "hard-rock-mine" cannot be turned back into "Hard Rock Mine" without the
 * list of real names.
 */
export function findBySlug<T>(
  items: readonly T[],
  slug: string,
  nameOf: (item: T) => string,
): T | undefined {
  const wanted = slugify(slug);
  return items.find((item) => slugify(nameOf(item)) === wanted);
}
