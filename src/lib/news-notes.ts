/**
 * Original commentary on official news posts.
 *
 * A page of links to supercell.com is a page anyone could assemble, and it is
 * worth reading only for the one thing this site can add and they cannot: what
 * the update did to the numbers here. A note is that sentence.
 *
 * Sparse on purpose, and this is the important part. Most official posts are
 * esports announcements — a finals format, a ticketing guide — and they have
 * no meta implication at all. Writing "what this means for the meta" under a
 * ticketing guide would be filler, which is worse than an unannotated link:
 * it teaches people that the notes are padding and they stop reading the ones
 * that say something. So a post with nothing to say gets no note, and the
 * block does not render.
 *
 * Keyed on the URL's last path segment rather than the full URL. Supercell
 * moves posts between locale and category prefixes; the slug is what survives.
 *
 * Written by hand. These are claims about what a patch did, and a claim like
 * that has to come from someone who read the patch and watched the numbers
 * move — generating one from the title would be inventing analysis, which is
 * the failure this exists to avoid.
 */
const NOTES: Record<string, string> = {
  // Add entries as:
  //
  //   'release-notes-june-2026':
  //     'The Piper nerf shows up as a 1.4 drop in her Ranked meta score over ' +
  //     'the fortnight after the patch, and Ranked pick rate fell with it. ' +
  //     'The ladder barely moved, which is the usual split.',
  //
  // Keep it to a sentence or two, make it specific, and only write one when
  // the numbers on this site actually say something. See `getMetaMovers` and
  // the tier list's "What changed" panel for where to read that off.
};

/** The slug a note is keyed on, or null for a URL that has no path. */
export function newsSlug(url: string): string | null {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : null;
  } catch {
    // A malformed URL simply has no note.
    return null;
  }
}

/** The note for a post, or null when there is nothing worth saying. */
export function noteFor(url: string): string | null {
  const slug = newsSlug(url);
  return slug ? (NOTES[slug] ?? null) : null;
}
