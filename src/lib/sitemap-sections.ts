/**
 * The sitemap's four files, shared by the index at `/sitemap.xml` and the
 * generator at `src/app/sitemaps/sitemap.ts`. Kept apart from both because a
 * metadata route file is only allowed its own exports.
 */
export const SECTIONS = ['core', 'maps', 'compare', 'players'] as const;
export type Section = (typeof SECTIONS)[number];
