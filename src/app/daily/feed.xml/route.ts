import { dayLabel } from '@/components/daily/daily-report';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { listDailyReports, getDailyReport } from '@/lib/stats';

/**
 * RSS for the daily findings.
 *
 * A feed rather than only a page, because this is the one part of the site that
 * is genuinely periodical: a new report, dated, that supersedes nothing. That
 * is what a feed is for, and it is also how the Discord and social posts can
 * eventually be driven from one source instead of a second code path.
 *
 * Items carry the findings as plain sentences rather than a link and a title.
 * A reader scanning a feed should be able to tell whether a day is worth
 * opening without opening it.
 */
export const revalidate = 3600;

/** Enough recent days to be useful without making the feed a download. */
const ITEMS = 30;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** The kinds, spelled as the feed's one-line summary of each finding. */
const KIND_LABEL: Record<string, string> = {
  'secret-pick': 'The secret pick',
  'meta-trap': 'The meta trap',
  'giant-killer': 'The giant killer',
  'secret-duo': 'The secret duo',
  'map-surprise': 'The map surprise',
  'overnight-rise': 'The overnight rise',
};

export async function GET(): Promise<Response> {
  const reports = await listDailyReports(ITEMS).catch(() => []);

  const items = await Promise.all(
    reports.map(async (entry) => {
      const report = await getDailyReport(entry.day).catch(() => null);
      const url = `${SITE_URL}/daily/${entry.day}`;
      const label = dayLabel(entry.day);

      const lines = (report?.discoveries ?? []).map((discovery) => {
        const kind = KIND_LABEL[discovery.kind] ?? 'Finding';
        const names = discovery.brawlerNames
          .map((name) => name.charAt(0) + name.slice(1).toLowerCase())
          .join(' and ');
        const where = discovery.context ? ` on ${discovery.context}` : '';
        return `<li>${escapeXml(`${kind}: ${names}${where}`)}</li>`;
      });

      return [
        '    <item>',
        `      <title>${escapeXml(`What we found on ${label}`)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${new Date(`${entry.day}T12:00:00Z`).toUTCString()}</pubDate>`,
        `      <description><![CDATA[<ul>${lines.join('')}</ul>]]></description>`,
        '    </item>',
      ].join('\n');
    }),
  );

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(`${SITE_NAME} — daily findings`)}</title>`,
    `    <link>${SITE_URL}/daily</link>`,
    `    <atom:link href="${SITE_URL}/daily/feed.xml" rel="self" type="application/rss+xml" />`,
    '    <description>Things the sampled Brawl Stars battles say that a ranked table does not, one report a day.</description>',
    '    <language>en</language>',
    ...items,
    '  </channel>',
    '</rss>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 6}`,
    },
  });
}
