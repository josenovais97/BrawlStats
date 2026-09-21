import { SECTIONS } from '@/lib/sitemap-sections';
import { SITE_URL } from '@/lib/site';

/**
 * A sitemap index, so `/sitemap.xml` — the address Search Console has had
 * since day one — keeps working while the listing itself lives in four files.
 *
 * Next's `generateSitemaps` writes the children but not the index that ties
 * them together; this is that. It carries no `lastmod` of its own: the
 * children date their entries, and a date here would be the build timestamp
 * this change exists to stop sending.
 *
 * Prerendered at build (no dynamic segment, a `revalidate`) and static in
 * practice: it lists four addresses that only change when a section is added.
 */
export const revalidate = 86400;

export function GET(): Response {
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...SECTIONS.map((id) => `  <sitemap><loc>${SITE_URL}/sitemaps/sitemap/${id}.xml</loc></sitemap>`),
    '</sitemapindex>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
