/**
 * Announced in a Brawl Talk, not yet in the game.
 *
 * Hand-written, and it has to be: checked 2026-08-31, the wiki has no
 * structured source for unreleased content — Category:Upcoming,
 * Category:Unreleased, Category:Upcoming Brawlers and Category:Unreleased
 * Brawlers all return zero members, and there is no Brawl Talk page. The
 * version history covers what shipped, which is what `lib/game-updates` reads.
 *
 * Worth the manual step because of when it pays. The hours after an
 * announcement are when the searches happen and when nobody has published
 * anything, and a page that already names the brawler is the one that gets
 * found. Everything else on this site is measured; this is the one place that
 * is deliberately ahead of the data.
 *
 * Curated in, automatic out: an entry naming a brawler disappears on its own
 * once that brawler appears in the live catalogue, so a stale "coming soon"
 * cannot sit here after release. `announcedOn` is shown, so a reader can see
 * how old the claim is.
 */

export type AnnouncedKind = 'brawler' | 'hypercharge' | 'buffie' | 'rework' | 'feature';

export interface Announced {
  /** The brawler this concerns, or the feature's own name. */
  name: string;
  kind: AnnouncedKind;
  /** One line, in your own words. Never a transcript of the video. */
  note: string;
  /** ISO date the announcement was made. */
  announcedOn: string;
  /** Where it was announced, for anyone who wants to check. */
  source?: string;
}

/**
 * Fill this from the Brawl Talk. Example of the shape:
 *
 *   {
 *     name: 'Nori',
 *     kind: 'brawler',
 *     note: 'New legendary assassin, arriving with the September update.',
 *     announcedOn: '2026-08-30',
 *     source: 'https://www.youtube.com/watch?v=...',
 *   },
 *
 * Keep notes short and factual. A sentence that says what it is and roughly
 * when beats a paragraph, and it is the part search engines show.
 */
export const ANNOUNCED: Announced[] = [];

export const KIND_LABEL: Record<AnnouncedKind, string> = {
  brawler: 'New brawler',
  hypercharge: 'New hypercharge',
  buffie: 'New buffie',
  rework: 'Rework',
  feature: 'New feature',
};

/**
 * Entries still genuinely unreleased.
 *
 * A brawler already in the catalogue has shipped, so its announcement is
 * history rather than news and drops out without anyone editing this file.
 * Other kinds cannot be checked that way and stay until removed by hand.
 */
export function pendingAnnouncements(liveBrawlerNames: Iterable<string>): Announced[] {
  const live = new Set([...liveBrawlerNames].map((n) => n.toLowerCase()));
  return ANNOUNCED.filter((a) => a.kind !== 'brawler' || !live.has(a.name.toLowerCase()));
}
