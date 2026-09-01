import 'server-only';
import { USER_AGENT } from '@/lib/site';

/**
 * Official release notes, resolved automatically.
 *
 * Supercell publishes one post per game update at a predictable URL:
 *   /blog/release-notes/release-notes-<month>-<year>/
 *
 * There is no index endpoint listing them, so the latest is found by walking
 * backwards from the current month until one responds. That keeps the page
 * current with no manual step: when September's notes go live, the September
 * URL starts returning 200 and the walk stops there instead.
 *
 * The post body is Contentful rich text embedded in the page's `__NEXT_DATA__`
 * payload, which is far more stable to parse than rendered markup.
 */

const BLOG_BASE = 'https://supercell.com/en/games/brawlstars/blog/release-notes';

/** How many months back to look before giving up. */
const MAX_MONTHS_BACK = 14;

/** Revalidate hourly: notes change on update day and then sit still. */
const REVALIDATE = 3600;

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/* ------------------------------- rich text ------------------------------- */

export type RichMark = 'bold' | 'italic' | 'underline';

export interface RichText {
  type: 'text';
  value: string;
  marks: RichMark[];
}

export interface RichParagraph {
  type: 'paragraph';
  spans: RichText[];
}

export interface RichHeading {
  type: 'heading';
  level: 2 | 3;
  spans: RichText[];
}

export interface RichList {
  type: 'list';
  items: RichParagraph[][];
}

export type RichNode = RichParagraph | RichHeading | RichList;

export interface ReleaseSection {
  title: string | null;
  nodes: RichNode[];
}

export interface ReleaseNotes {
  title: string;
  publishedAt: string | null;
  url: string;
  /** e.g. "june-2026", useful as a stable key. */
  slug: string;
  heroImageUrl: string | null;
  sections: ReleaseSection[];
}

/* -------------------------------- parsing -------------------------------- */

interface RawNode {
  nodeType?: string;
  value?: string;
  marks?: { type?: string }[];
  content?: RawNode[];
}

const KNOWN_MARKS = new Set<RichMark>(['bold', 'italic', 'underline']);

function collectSpans(node: RawNode | undefined): RichText[] {
  if (!node?.content) return [];
  const spans: RichText[] = [];

  for (const child of node.content) {
    if (child.nodeType === 'text' && typeof child.value === 'string') {
      const marks = (child.marks ?? [])
        .map((m) => m.type)
        .filter((m): m is RichMark => !!m && KNOWN_MARKS.has(m as RichMark));
      spans.push({ type: 'text', value: child.value, marks });
    } else if (child.content) {
      // Unwrap anything unexpected rather than dropping its text.
      spans.push(...collectSpans(child));
    }
  }

  return spans;
}

function parseNodes(content: RawNode[] | undefined): RichNode[] {
  if (!content) return [];
  const nodes: RichNode[] = [];

  for (const node of content) {
    switch (node.nodeType) {
      case 'paragraph': {
        const spans = collectSpans(node);
        if (spans.some((s) => s.value.trim())) nodes.push({ type: 'paragraph', spans });
        break;
      }
      case 'heading-1':
      case 'heading-2':
        nodes.push({ type: 'heading', level: 2, spans: collectSpans(node) });
        break;
      case 'heading-3':
      case 'heading-4':
      case 'heading-5':
      case 'heading-6':
        nodes.push({ type: 'heading', level: 3, spans: collectSpans(node) });
        break;
      case 'unordered-list':
      case 'ordered-list': {
        const items = (node.content ?? [])
          .filter((li) => li.nodeType === 'list-item')
          .map((li) =>
            (li.content ?? [])
              .filter((p) => p.nodeType === 'paragraph')
              .map((p) => ({ type: 'paragraph' as const, spans: collectSpans(p) }))
              .filter((p) => p.spans.some((s) => s.value.trim())),
          )
          .filter((item) => item.length > 0);
        if (items.length > 0) nodes.push({ type: 'list', items });
        break;
      }
      default:
        // Unhandled block: recurse so nested text still surfaces.
        if (node.content) nodes.push(...parseNodes(node.content));
    }
  }

  return nodes;
}

/* -------------------------------- fetching ------------------------------- */

interface RawPageProps {
  title?: unknown;
  publishDate?: unknown;
  hero?: unknown;
  bodyCollection?: { title?: unknown; text?: { json?: RawNode } }[];
}

async function fetchNotes(slug: string): Promise<ReleaseNotes | null> {
  const url = `${BLOG_BASE}/release-notes-${slug}/`;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  try {
    const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
    if (!match) return null;

    const data = JSON.parse(match[1]) as { props?: { pageProps?: RawPageProps } };
    const pageProps = data.props?.pageProps;
    if (!pageProps) return null;

    const sections: ReleaseSection[] = (pageProps.bodyCollection ?? [])
      .map((block) => ({
        title: typeof block.title === 'string' ? block.title : null,
        nodes: parseNodes(block.text?.json?.content),
      }))
      .filter((section) => section.nodes.length > 0 || section.title);

    if (sections.length === 0) return null;

    return {
      title:
        typeof pageProps.title === 'string' ? pageProps.title : `Release notes ${slug}`,
      publishedAt:
        typeof pageProps.publishDate === 'string' ? pageProps.publishDate : null,
      url,
      slug,
      heroImageUrl: typeof pageProps.hero === 'string' ? pageProps.hero : null,
      sections,
    };
  } catch {
    return null;
  }
}

/** Month slugs from `from` backwards, e.g. "august-2026", "july-2026", … */
export function monthSlugsBackFrom(from: Date, count = MAX_MONTHS_BACK): string[] {
  const slugs: string[] = [];
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();

  for (let i = 0; i < count; i++) {
    slugs.push(`${MONTH_NAMES[month]}-${year}`);
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }

  return slugs;
}

/**
 * The most recent release notes available, or null if none resolved.
 *
 * Requests are sequential and stop at the first hit, so the common case (this
 * month or last month) costs one or two requests.
 */
export async function getLatestReleaseNotes(now = new Date()): Promise<ReleaseNotes | null> {
  for (const slug of monthSlugsBackFrom(now)) {
    const notes = await fetchNotes(slug);
    if (notes) return notes;
  }
  return null;
}

/** Plain text of a rich-text run, for previews and search. */
export function spansToText(spans: RichText[]): string {
  return spans.map((s) => s.value).join('');
}

/* ------------------------- who an update touched -------------------------- */

/**
 * Which brawlers an update changed, taken from the official notes themselves.
 *
 * This used to be parsed from the community wiki's version history, which is
 * written by hand and lags: on 2026-09-01 the site showed a June summary
 * directly above September's actual notes, which is worse than showing
 * nothing. The official post is already fetched for this page, always
 * describes the update being displayed, and needs no editor — so the summary
 * is current by construction rather than by luck.
 *
 * Only names are taken. The prose is Supercell's and stays where it is; what
 * this adds is a scannable index that links each brawler to our own page for
 * it, which is the thing a reader actually wants in the hour after an update.
 *
 * Sections are matched by title against a fixed list rather than scanned
 * wholesale, because a brawler is mentioned all over a release post — in skin
 * announcements, bug fixes and event blurbs — and none of those mean the
 * brawler was changed.
 */
export type ChangeCategory = 'brawlers' | 'hypercharges' | 'buffies' | 'balance';

const CATEGORY_MATCHERS: { key: ChangeCategory; test: RegExp }[] = [
  { key: 'brawlers', test: /new\s+brawler/i },
  { key: 'hypercharges', test: /hypercharge/i },
  { key: 'buffies', test: /buffie/i },
  { key: 'balance', test: /balance/i },
];

export const CHANGE_LABEL: Record<ChangeCategory, string> = {
  brawlers: 'New brawlers',
  hypercharges: 'New hypercharges',
  buffies: 'New buffies',
  balance: 'Balance changes',
};

/** Flattens a node to plain text, so a name can be found wherever it sits. */
function nodeText(node: RichNode): string {
  if (node.type === 'list') {
    return node.items.flat().map(nodeText).join(' ');
  }
  return node.spans.map((span) => span.value).join(' ');
}

/**
 * Brawlers named in each category section of an update.
 *
 * `known` should include unreleased brawlers as well as the live catalogue —
 * a "new brawlers" section names exactly the ones the game API does not have
 * yet, so matching on the catalogue alone finds nothing there.
 */
export function changesFromNotes(
  notes: ReleaseNotes,
  known: string[],
): { category: ChangeCategory; brawlers: string[] }[] {
  const out: { category: ChangeCategory; brawlers: string[] }[] = [];

  for (const section of notes.sections) {
    if (!section.title) continue;
    const matched = CATEGORY_MATCHERS.find((c) => c.test.test(section.title!));
    if (!matched) continue;

    const body = section.nodes.map(nodeText).join(' ');
    const found: string[] = [];
    for (const name of known) {
      // Word-bounded so "Max" does not match "maximum" and "Bo" does not
      // match "Bonnie".
      const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(body) && !found.includes(name)) found.push(name);
    }
    if (found.length === 0) continue;

    const existing = out.find((o) => o.category === matched.key);
    if (existing) {
      for (const n of found) if (!existing.brawlers.includes(n)) existing.brawlers.push(n);
    } else {
      out.push({ category: matched.key, brawlers: found });
    }
  }

  return out;
}
