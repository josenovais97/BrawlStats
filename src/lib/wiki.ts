/**
 * Shared plumbing for reading the Brawl Stars wiki.
 *
 * Three modules now read from it — brawlers, ranked seasons and maps — and
 * they all need the same two things: a fetch that never lets a failure stick,
 * and enough wikitext handling to get plain prose out of markup. Both live
 * here so a fix lands once.
 *
 * Wiki text is CC-BY-SA and is attributed wherever it is rendered.
 */

import { USER_AGENT } from '@/lib/site';

export const WIKI_API = 'https://brawlstars.fandom.com/api.php';

/**
 * Fetches JSON, and never lets a failure stick.
 *
 * Next's data cache stores what a `fetch` with `revalidate` returned — status
 * included — so a wiki 5xx during a regeneration would be replayed for the
 * whole TTL, hiding a section for hours after the wiki itself recovered. A
 * non-OK response is therefore retried once with `cache: 'no-store'`, which
 * bypasses that entry entirely: the render gets live data the moment the wiki
 * is healthy again, at the cost of one extra request per render while it is
 * not.
 */
export async function fetchWikiJson<T>(
  url: string,
  revalidate: number,
): Promise<T | null> {
  const init = {
    headers: {
      // Identify ourselves rather than pretending to be a browser.
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  } as const;

  try {
    let res = await fetch(url, { ...init, next: { revalidate } });
    if (!res.ok) res = await fetch(url, { ...init, cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Shape of a `prop=revisions` response, which is how every page is read. */
export interface WikiPagesResponse {
  query?: {
    pages?: Record<
      string,
      { title?: string; missing?: unknown; revisions?: { slots?: { main?: { '*'?: unknown } } }[] }
    >;
  };
}

export interface WikiPage {
  title: string;
  wikitext: string;
}

/** Pulls the first page with content out of a `prop=revisions` response. */
export function firstPage(body: WikiPagesResponse | null): WikiPage | null {
  for (const page of Object.values(body?.query?.pages ?? {})) {
    const wikitext = page.revisions?.[0]?.slots?.main?.['*'];
    if (typeof wikitext === 'string' && wikitext.length > 0) {
      return { title: page.title ?? '', wikitext };
    }
  }
  return null;
}

/* -------------------------------- wikitext -------------------------------- */

/**
 * Reduces wikitext to plain prose.
 *
 * Order matters: templates are stripped before links, because a template can
 * contain a link but not the reverse, and `<br>` becomes a space last so
 * multi-line values collapse into one readable line.
 */
export function toPlainText(value: string): string {
  return value
    .replace(/\{\{[^{}]*\}\}/g, '')
    // [[Target|Label]] keeps the label; [[Target]] keeps the target.
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    // `[\s\S]` rather than the `s` flag: the project targets a lower lib level
    // than dotAll, and this is the portable equivalent.
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extracts a balanced `{{…}}` block starting at `from`. */
export function balancedTemplate(text: string, from: number): string | null {
  let depth = 0;
  let i = from;
  while (i < text.length) {
    if (text.startsWith('{{', i)) {
      depth += 1;
      i += 2;
      continue;
    }
    if (text.startsWith('}}', i)) {
      depth -= 1;
      i += 2;
      if (depth === 0) return text.slice(from, i);
      continue;
    }
    i += 1;
  }
  return null;
}

/**
 * Parses a named infobox template into its parameters.
 *
 * Matched loosely on purpose, in two ways.
 *
 * The prefix is open because brawlers with a second form carry their own
 * template — `{{Chester Infobox}}`, `{{Kaze Infobox}}` — with the same
 * parameter names as the shared one.
 *
 * And spaces in a template name are matched as "space or underscore", because
 * MediaWiki treats the two as the same character in a page title and editors
 * use them interchangeably. Brock's page says `{{Brawler_Infobox`, everyone
 * else's says `{{Brawler Infobox`, and it is the same template: a pattern that
 * only allowed the space silently dropped every combat stat on that page while
 * the rest of it carried on working.
 */
export function parseInfobox(wikitext: string, kind = 'Infobox'): Record<string, string> {
  const name = kind.replace(/[ _]+/g, '[ _]+');
  const match = new RegExp(`\\{\\{[A-Za-z _-]*?${name}`).exec(wikitext);
  if (!match) return {};

  const box = balancedTemplate(wikitext, match.index);
  if (!box) return {};

  const body = box.slice(box.indexOf('|') + 1, -2);
  const params: Record<string, string> = {};

  // Split on pipes that are not inside a nested link or template.
  for (const part of body.split(/\|(?![^[{]*[\]}]\})/)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    params[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }

  return params;
}

/** The `{{Quote|…}}` opening a section, i.e. the in-game text. */
export function leadQuote(section: string): string | null {
  const at = section.indexOf('{{Quote|');
  if (at === -1) return null;
  const block = balancedTemplate(section, at);
  if (!block) return null;
  return toPlainText(block.slice('{{Quote|'.length, -2)) || null;
}

/** The body of a `==Heading==` section, up to the next same-or-higher heading. */
export function sectionBody(wikitext: string, heading: string): string | null {
  const at = wikitext.indexOf(`==${heading}==`);
  if (at === -1) return null;
  const start = at + heading.length + 4;
  const end = wikitext.indexOf('\n==', start);
  return wikitext.slice(start, end === -1 ? undefined : end);
}

/** Splits a page into its `===Heading===` subsections. */
export function subsections(wikitext: string): { heading: string; body: string }[] {
  const out: { heading: string; body: string }[] = [];
  const pattern = /^===\s*([^=]+?)\s*===$/gm;

  const marks: { heading: string; start: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(wikitext)) !== null) {
    marks.push({ heading: match[1], start: match.index + match[0].length });
  }

  for (let i = 0; i < marks.length; i += 1) {
    // A subsection runs to the next subsection or the next top-level heading,
    // whichever comes first.
    const nextMark = marks[i + 1]?.start ?? wikitext.length;
    const nextTop = wikitext.indexOf('\n==', marks[i].start);
    const end = nextTop === -1 ? nextMark : Math.min(nextMark, nextTop);
    out.push({ heading: marks[i].heading, body: wikitext.slice(marks[i].start, end) });
  }

  return out;
}

/** Public URL of a wiki page, for attribution. */
export function wikiPageUrl(title: string): string {
  return `https://brawlstars.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}
