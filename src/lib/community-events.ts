import 'server-only';

import { cached } from '@/lib/cached';
import { WIKI_API, fetchWikiJson, wikiPageUrl } from '@/lib/wiki';
import { slugify } from '@/lib/slugs';

/**
 * Community events — the game-wide challenges Supercell runs a few times a
 * year, where the whole player base grinds a shared target for a shared
 * reward.
 *
 * No API publishes these. The game announces them in-client and on social
 * media, the rewards and milestones change per event, and by the time one
 * finishes the only durable record is the wiki's. So this reads the wiki page
 * and re-reads it: when somebody adds the next event, or fills in a milestone
 * that has since been hit, the site has it within the cache window without
 * anybody touching the code.
 *
 * That is also the risk, and it is why nothing here throws. The page is
 * community-edited, its tables have a different shape in every event — three
 * columns for one, five for another — and a heading can be renamed at any
 * time. Every parser below returns what it can and drops what it cannot, so a
 * malformed table costs its own event rather than the page.
 */

/** The page holding the current year's events. */
const PAGE = 'Community Events/2026';

/**
 * Six hours.
 *
 * An event's milestones move over days, not minutes, and the page is a
 * volunteer's write-up rather than a feed. Long enough that the wiki is asked
 * four times a day; short enough that a new event appears the same morning.
 */
const REVALIDATE = 21_600;

export interface EventTable {
  headers: string[];
  rows: string[][];
}

export interface CommunityEvent {
  name: string;
  /** URL fragment, so an event can be linked to directly. */
  slug: string;
  /** ISO date the event began, when the page states one. */
  startedOn: string | null;
  /** The write-up, as plain prose. */
  description: string;
  /** Milestones and rewards. Null when the event has no table yet. */
  table: EventTable | null;
  /** `File:…` title of the event's artwork, for the image lookup. */
  imageTitle: string | null;
  /** Resolved artwork URL, or null when the wiki has none. */
  imageUrl: string | null;
}

/**
 * Wikitext to prose, with the currency the game's own templates carry.
 *
 * `toPlainText` in `lib/wiki` drops `{{…}}` entirely, which is right for an
 * infobox value and wrong twice over here. The reward cells read
 * `5{{Icon|Chaos Drop}}Chaos Drops`, where the template is the only space
 * between the number and the noun — stripping it yields "5Chaos Drops". And
 * where the prose does *not* repeat the noun, as in `5{{Icon|Chaos Drop}}`
 * alone, the template is the only thing naming the reward at all: stripping it
 * leaves a bare "5", which is how the first version of this rendered a whole
 * column of the #FormulaBrawl table.
 *
 * So a template's argument is kept, unless the text immediately after it
 * already says the same word. `{{Modifier|Fog of War}}` works the same way; no
 * template on this page needs special handling.
 */
function cellText(value: string): string {
  return value
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<ref[^>]*\/>/g, '')
    /*
     * `{{Icon|Chaos Drop}}5` -> `5{{Icon|Chaos Drop}}`.
     *
     * Both orders appear on the page and both render identically on the wiki,
     * because there the template is a picture and a reader takes the number
     * with it either way. In prose the order is the meaning: the #FormulaBrawl
     * rewards came out as "Chaos Drop 5".
     */
    .replace(/(\{\{[^{}]*\}\})\s*(\d[\d,.]*)/g, '$2$1')
    // `{{Icon|Gem}}Gems` -> " Gems"; `{{Icon|Gem}}` alone -> " Gem ".
    .replace(/\{\{[^{}|]*\|([^{}|]+)\}\}\s*/g, (match, name: string, offset: number, whole: string) => {
      const rest = whole.slice(offset + match.length);
      const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`^${escaped}s?\\b`, 'i').test(rest) ? ' ' : ` ${name.trim()} `;
    })
    // Argument-less templates carry nothing a reader needs.
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    .replace(/\[\[File:[^\]]*\]\]/gi, ' ')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    // [https://example.com label] keeps the label; a bare URL keeps nothing.
    .replace(/\[(?:https?:)?\/\/\S+\s+([^\]]+)\]/g, '$1')
    .replace(/\[(?:https?:)?\/\/\S+\]/g, '')
    .replace(/'''?/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    // The substitutions above pad with spaces, which strands punctuation:
    // "500 Coin , 1000 Coin , or …".
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

/**
 * The first wikitable in a section, as headers and rows.
 *
 * Deliberately shape-agnostic. The seven events on the 2026 page use four
 * different column layouts between them, and an event added next month will
 * use a fifth; a parser that expected "task, requirement, reward" would render
 * nothing for most of the page. Whatever the headers say is what gets
 * rendered.
 *
 * Rows whose cell count does not match the header are padded or trimmed rather
 * than dropped — a missing trailing cell is the single most common thing a
 * hand-written wikitable gets wrong, and losing the row loses a milestone.
 */
function parseTable(section: string): EventTable | null {
  const start = section.indexOf('{|');
  if (start === -1) return null;
  const end = section.indexOf('|}', start);
  const body = section.slice(start, end === -1 ? undefined : end);

  const headers: string[] = [];
  const rows: string[][] = [];
  let current: string[] | null = null;

  for (const raw of body.split('\n')) {
    const line = raw.trim();

    if (line.startsWith('|-')) {
      if (current && current.length > 0) rows.push(current);
      current = [];
      continue;
    }

    if (line.startsWith('!')) {
      // `! a !! b` is the inline form of two header cells.
      for (const cell of line.slice(1).split('!!')) {
        const text = cellText(cell);
        if (text) headers.push(text);
      }
      continue;
    }

    if (line.startsWith('|') && !line.startsWith('{|')) {
      if (current === null) continue;
      for (const cell of line.slice(1).split('||')) current.push(cellText(cell));
    }
  }
  if (current && current.length > 0) rows.push(current);

  if (headers.length === 0 || rows.length === 0) return null;

  const shaped = rows.map((row) => {
    const copy = row.slice(0, headers.length);
    while (copy.length < headers.length) copy.push('');
    return copy;
  });

  return { headers, rows: shaped };
}

/** "19/09/26" — the page's own format — as an ISO date. */
function parseStartDate(section: string): string | null {
  const match = /started on (\d{2})\/(\d{2})\/(\d{2})/.exec(section);
  if (!match) return null;
  const [, day, month, year] = match;
  return `20${year}-${month}-${day}`;
}

/** The section's lead image, which every event on the page opens with. */
function parseImageTitle(section: string): string | null {
  const match = /\[\[File:([^|\]]+)/i.exec(section);
  return match ? `File:${match[1].trim().replace(/_/g, ' ')}` : null;
}

interface ParseResponse {
  parse?: { wikitext?: string };
}

interface ImageInfoResponse {
  query?: {
    pages?: Record<string, { title?: string; imageinfo?: { url?: string; thumburl?: string }[] }>;
  };
}

/** Event artwork, all of it in one request. */
async function resolveImages(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (titles.length === 0) return out;

  const url = new URL(WIKI_API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('titles', titles.join('|'));
  url.searchParams.set('iiprop', 'url');
  // Requested through the scaler: the originals are megabytes, and this is a
  // card image.
  url.searchParams.set('iiurlwidth', '320');
  url.searchParams.set('format', 'json');

  const body = await fetchWikiJson<ImageInfoResponse>(url.toString(), REVALIDATE);
  for (const page of Object.values(body?.query?.pages ?? {})) {
    const src = page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url;
    if (page.title && src) out.set(page.title, src);
  }
  return out;
}

async function fetchCommunityEvents(): Promise<CommunityEvent[]> {
  const url = new URL(WIKI_API);
  url.searchParams.set('action', 'parse');
  url.searchParams.set('page', PAGE);
  url.searchParams.set('prop', 'wikitext');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');

  const body = await fetchWikiJson<ParseResponse>(url.toString(), REVALIDATE);
  const wikitext = body?.parse?.wikitext;
  if (!wikitext) return [];

  // Top-level headings only. An event's own subsections belong to it.
  const pattern = /^\s*==\s*([^=]+?)\s*==\s*$/gm;
  const marks: { name: string; start: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(wikitext)) !== null) {
    marks.push({ name: match[1].trim(), start: match.index + match[0].length });
  }

  const events: CommunityEvent[] = marks.map((mark, i) => {
    const section = wikitext.slice(mark.start, marks[i + 1]?.start ?? wikitext.length);
    // The prose above the first table, minus the file embed that opens it.
    const beforeTable = section.split('{|')[0].replace(/\[\[File:[^\]]*\]\]/gi, ' ');

    return {
      name: mark.name,
      slug: slugify(mark.name.replace(/^#/, '')),
      startedOn: parseStartDate(section),
      description: cellText(beforeTable),
      table: parseTable(section),
      imageTitle: parseImageTitle(section),
      imageUrl: null,
    };
  });

  const images = await resolveImages(
    [...new Set(events.map((e) => e.imageTitle).filter((t): t is string => t !== null))],
  );
  for (const event of events) {
    event.imageUrl = event.imageTitle ? (images.get(event.imageTitle) ?? null) : null;
  }

  // Newest first. An event with no parseable date sorts last rather than
  // first: an unknown date is not evidence of recency.
  return events.sort((a, b) => (b.startedOn ?? '').localeCompare(a.startedOn ?? ''));
}

export const getCommunityEvents = cached(
  'community-events',
  fetchCommunityEvents,
  REVALIDATE,
);

/** Where the write-up lives, for attribution. Wiki text is CC-BY-SA. */
export const COMMUNITY_EVENTS_URL = wikiPageUrl(PAGE);
