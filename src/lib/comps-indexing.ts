/**
 * The fewest comps a mode page needs before it is offered to search
 * (2026-10-27).
 *
 * The comp floors (see AGENTS.md, "a trio of brawlers is a proxy for a trio
 * of players") leave some modes with one or two trios: Siege showed two, a
 * page of 97 words. That is the thin page AdSense's "low value content"
 * review looks for, so such a mode stays up for visitors but out of the
 * sitemap and `noindex` until the 14-day window gives it more. The sitemap
 * and the page read this one number so they cannot disagree.
 */
export const MIN_INDEXABLE_COMPS = 3;
