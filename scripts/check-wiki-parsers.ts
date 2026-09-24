/*
 * Are the wiki parsers still seeing everything the wiki is showing?
 *
 * Two pages on this site are read straight from the Brawl Stars wiki and
 * re-read forever after: the Starr Drops odds and the community events. That
 * is the whole point of them — a new drop or a new event appears without the
 * site being changed — and it is also the one way they can go wrong quietly.
 *
 * A wiki page is community-edited. Somebody restructures a section, renames a
 * heading, or swaps a table for a template, and the parser stops finding that
 * part. Nothing errors. The page still renders, still looks complete, and is
 * simply missing a drop type or a milestone table. The failure that is easy to
 * catch — the wiki being unreachable — is already handled, because both pages
 * degrade to an error state. This is for the other one.
 *
 * The cross-check is deliberately a SECOND, dumber implementation: it counts
 * headings and `{|` table openings with its own regexes and compares those
 * totals against what the real parsers returned. Reusing the parsers to check
 * the parsers would agree with itself by construction and prove nothing.
 *
 * Warnings only. A drifted parser is a page missing a section, not an outage,
 * and failing the sampler over it would park the roll-up prune for a cosmetic
 * problem.
 */
import { getCommunityEvents } from '../src/lib/community-events';
import { getStarrDrops } from '../src/lib/starr-drops';
import { WIKI_API } from '../src/lib/wiki';

/** Raw wikitext for a page, fetched without any of the app's caching. */
async function wikitext(page: string): Promise<string | null> {
  const url = new URL(WIKI_API);
  url.searchParams.set('action', 'parse');
  url.searchParams.set('page', page);
  url.searchParams.set('prop', 'wikitext');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');

  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'BrawlZone (+https://brawlzone.net)' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { parse?: { wikitext?: string } };
    return body.parse?.wikitext ?? null;
  } catch {
    return null;
  }
}

/** Sections at one heading depth, with the text belonging to each. */
function sectionsAt(text: string, depth: number): { heading: string; body: string }[] {
  const marker = '='.repeat(depth);
  const pattern = new RegExp(`^${marker}\\s*([^=]+?)\\s*${marker}\\s*$`, 'gm');
  const marks: { heading: string; start: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    marks.push({ heading: match[1].trim(), start: match.index + match[0].length });
  }
  return marks.map((mark, i) => ({
    heading: mark.heading,
    body: text.slice(mark.start, marks[i + 1]?.start ?? text.length),
  }));
}

/** Every wikitable opening in a section. */
function tableCount(body: string): number {
  return (body.match(/\{\|/g) ?? []).length;
}

/**
 * Wikitables that are reward tables, rather than every table in the section.
 *
 * Counting all of them was the first version and it was wrong the moment it
 * ran: Chaos Drops carries a "Split Probabilities" table — how many drops an
 * opening yields, not what is in them — which the real parser correctly
 * ignores, so a check that counted it reported a miss that was not there.
 *
 * `chance` or `chances` in the opening rows is what separates the two. Not
 * "drop chance", which was the second attempt: Sushi Rolls captions its tables
 * "Sushi Roll Chances" and heads the columns "Chance", and the stricter phrase
 * missed both. Verified against all thirteen drop types on 2026-09-24 — every
 * one agrees with the real parser under this rule.
 */
function rewardTableCount(body: string): number {
  return body
    .split('{|')
    .slice(1)
    .filter((table) => /\bchances?\b/i.test(table.slice(0, 400))).length;
}

async function checkStarrDrops(): Promise<string[]> {
  const problems: string[] = [];
  const [parsed, raw] = await Promise.all([
    getStarrDrops().catch(() => null),
    wikitext('Starr Drops'),
  ]);

  if (!raw) return problems; // Wiki unreachable: the page says so on its own.
  if (!parsed) {
    problems.push('Starr Drops: the wiki page fetched but nothing parsed out of it');
    return problems;
  }

  // Only the two groups the page is built from. The wiki's other level-2
  // headings — Daily Wins, Fallback Rewards, Gallery, History — are not drop
  // types and are excluded on purpose, here as in the parser.
  const groups = sectionsAt(raw, 2).filter(
    (s) => s.heading === 'Drop Types' || s.heading === 'Event Drops',
  );
  if (groups.length < 2) {
    problems.push(
      `Starr Drops: expected the "Drop Types" and "Event Drops" headings, found ${groups.length}. ` +
        'A new drop under a different heading would not be read at all.',
    );
    return problems;
  }

  const onWiki = groups.flatMap((g) => sectionsAt(g.body, 3));
  if (onWiki.length !== parsed.types.length) {
    problems.push(
      `Starr Drops: the wiki lists ${onWiki.length} drop types and ${parsed.types.length} parsed` +
        ` (missing: ${onWiki
          .map((s) => s.heading)
          .filter((h) => !parsed.types.some((t) => t.name === h))
          .join(', ') || 'none by name'})`,
    );
  }

  // Per type, because a total that still clears a floor hides one broken
  // table — and a drop with no rewards looks exactly like Hypercharge Starr
  // Drops, which legitimately has none.
  for (const section of onWiki) {
    const type = parsed.types.find((t) => t.name === section.heading);
    if (!type) continue;
    const expected = rewardTableCount(section.body);
    if (expected !== type.tables.length) {
      problems.push(
        `Starr Drops / ${section.heading}: ${expected} table(s) on the wiki, ${type.tables.length} parsed`,
      );
    }
  }

  return problems;
}

async function checkCommunityEvents(): Promise<string[]> {
  const problems: string[] = [];
  const [parsed, raw] = await Promise.all([
    getCommunityEvents().catch(() => []),
    wikitext('Community Events/2026'),
  ]);

  if (!raw) return problems;

  const onWiki = sectionsAt(raw, 2);
  if (onWiki.length === 0) {
    problems.push('Community events: no level-2 headings on the page — it has been restructured');
    return problems;
  }

  if (onWiki.length !== parsed.length) {
    problems.push(
      `Community events: the wiki lists ${onWiki.length} events and ${parsed.length} parsed` +
        ` (missing: ${onWiki
          .map((s) => s.heading)
          .filter((h) => !parsed.some((e) => e.name === h))
          .join(', ') || 'none by name'})`,
    );
  }

  for (const section of onWiki) {
    const event = parsed.find((e) => e.name === section.heading);
    if (!event) continue;
    // One table is what the page renders; the wiki sometimes carries extra
    // ones (race results, standings), so this only asks whether a section that
    // has any table produced one.
    if (tableCount(section.body) > 0 && event.table === null) {
      problems.push(
        `Community events / ${section.heading}: the wiki has a milestone table and none parsed`,
      );
    }
  }

  return problems;
}

async function main(): Promise<number> {
  const problems = [...(await checkStarrDrops()), ...(await checkCommunityEvents())];

  if (problems.length === 0) {
    console.log('Wiki parsers still see everything the wiki shows.');
    return 0;
  }

  for (const problem of problems) {
    console.error(`::warning::Wiki parser drift — ${problem}`);
  }
  console.error(
    '::warning::A wiki page has changed shape. The affected page still renders and is missing part of its content.',
  );
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`::warning::Wiki parser check threw: ${err instanceof Error ? err.message : err}`);
    process.exit(0);
  },
);
