import { WIKI_API, fetchWikiJson, subsections, toPlainText } from '@/lib/wiki';

/**
 * Starr Drop contents and the odds of each one.
 *
 * The game shows you a Starr Drop opening, never the table behind it, and
 * Supercell publishes no drop rates through any API — the official one covers
 * players, clubs, rankings, brawlers and events, and nothing about rewards.
 * What does publish them, maintained from datamines and in-game observation,
 * is the community wiki, as structured tables.
 *
 * This reads the same wiki the Ranked season panel does, and degrades the same
 * way: a failed fetch, a moved page or an unparseable table yields nothing and
 * the page says so, rather than showing invented numbers. Odds are the one
 * thing on a site like this that must never be guessed — a wrong percentage is
 * worse than an absent one, because a reader has no way to tell.
 *
 * Wiki text is CC-BY-SA, attributed on the page.
 */

const WIKI_PAGE = 'Starr Drops';
const WIKI_URL = `${WIKI_API}?action=parse&page=${encodeURIComponent(
  WIKI_PAGE,
).replace(/%20/g, '_')}&prop=wikitext&format=json`;

/** Drop tables change only on a balance update; twice a day is ample. */
const REVALIDATE_DROPS = 43_200;

export interface DropReward {
  /** What you get, e.g. "50 Coins" or "Ranked Spray". */
  reward: string;
  /** 0–1, or null when the wiki gave something unparseable. */
  chance: number | null;
}

export interface DropTable {
  /** The rarity this table belongs to, or null for a single-table drop. */
  rarity: string | null;
  rewards: DropReward[];
  /**
   * What the listed chances add up to, 0–1.
   *
   * A drop table is a closed set — every opening yields exactly one of these
   * rows — so this should be 1. It is carried rather than asserted because the
   * source is sometimes short: the Epic Starr Drop table on the wiki lists
   * seven rows totalling 94.73%, so a row is missing upstream. The page says
   * so instead of presenting an incomplete table as a complete one, which is
   * the failure a reader has no way to catch.
   */
  listed: number;
}

export interface DropType {
  name: string;
  slug: string;
  /** One or two sentences of plain prose. */
  description: string;
  /** Chance of the drop rolling each rarity, 0–1. Empty when not stated. */
  rarityOdds: { rarity: string; chance: number }[];
  tables: DropTable[];
  /** Which heading it came from: the permanent drops or the event ones. */
  group: 'core' | 'event';
}

export interface StarrDropData {
  types: DropType[];
  /** Where the numbers came from, for attribution. */
  sourceUrl: string;
}

/* --------------------------------- parsing -------------------------------- */

/**
 * Reads a chance cell.
 *
 * Two notations are in use and both appear on the same page: a literal
 * percentage, and `{{Chance|390|1011}}`, which is the wiki's way of writing a
 * fraction it wants rendered as one. The second is the more trustworthy of the
 * two — it carries the actual numerator and denominator — so it is tried first.
 */
function parseChance(cell: string): number | null {
  const fraction = cell.match(/\{\{\s*Chance\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\}\}/i);
  if (fraction) {
    const top = Number(fraction[1]);
    const bottom = Number(fraction[2]);
    if (bottom > 0 && Number.isFinite(top)) return top / bottom;
  }

  const percent = cell.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percent) {
    const value = Number(percent[1]);
    if (Number.isFinite(value)) return value / 100;
  }

  return null;
}

/**
 * Cleans a reward cell down to what you actually receive.
 *
 * The wiki nests the full list of every qualifying cosmetic inside a
 * collapsible block — one row can carry forty `{{Spray|…}}` templates — and
 * flattening that gives a reward called "Ranked Spray Power League Season 14
 * Common Power League Season 15 Common …". The collapsed content is dropped
 * before anything else runs, which leaves the label the row is actually about.
 */
function cleanReward(cell: string): string {
  const withoutCollapsed = cell.replace(
    /<div class="mw-collapsible-content"[\s\S]*/i,
    '',
  );
  return toPlainText(withoutCollapsed).replace(/\s{2,}/g, ' ').trim();
}

/** Every `{|class="article-table"…|}` block in a chunk of wikitext. */
function tableBlocks(body: string): { start: number; end: number; text: string }[] {
  const out: { start: number; end: number; text: string }[] = [];
  const opener = /\{\|\s*class="[^"]*article-table[^"]*"/g;
  let match: RegExpExecArray | null;

  while ((match = opener.exec(body)) !== null) {
    const end = body.indexOf('\n|}', match.index);
    if (end === -1) continue;
    out.push({ start: match.index, end, text: body.slice(match.index, end) });
  }

  return out;
}

/**
 * Rows of a drop table, as reward and chance.
 *
 * Header rows start with `!` and are skipped, which also discards the
 * `!colspan=2|… Chances` caption.
 *
 * MediaWiki accepts two cell separators and this page uses both. Simple rows
 * are written inline as `|reward||chance`. Rows whose reward carries a
 * collapsible list of every qualifying cosmetic are written across lines, with
 * the chance on its own line starting with `|` — and reading only `||` skipped
 * every one of those, which is not a harmless omission: it silently removed
 * 32% of the Epic Monster Egg table while leaving something that still looked
 * like a complete table. Newline-cells are normalised to `||` first.
 */
function parseTable(text: string): DropReward[] {
  const rewards: DropReward[] = [];

  for (const row of text.split(/\n\|-\s*\n?/)) {
    const line = row.trim();
    if (!line || line.startsWith('!') || line.startsWith('{|')) continue;

    const cells = line.replace(/\n\|/g, '||').replace(/^\|/, '').split('||');
    if (cells.length < 2) continue;

    const reward = cleanReward(cells[0]);
    if (!reward) continue;

    rewards.push({ reward, chance: parseChance(cells.slice(1).join('||')) });
  }

  return rewards;
}

/**
 * Which rarity each table belongs to.
 *
 * Multi-rarity drops wrap their tables in a `<tabber>`, where each tab is
 * introduced by `|-| Rare =`. The label immediately before a table is that
 * table's rarity; a table with no label before it is a single-table drop and
 * gets none.
 */
function rarityForTable(body: string, tableStart: number): string | null {
  const before = body.slice(0, tableStart);
  const labels = [...before.matchAll(/\|-\|\s*([^=|\n]+?)\s*=/g)];
  const last = labels[labels.length - 1];
  return last ? last[1].trim() : null;
}

/** "A Starr Drop has a 50% chance of being Rare, a 28% chance of being…" */
function parseRarityOdds(body: string): { rarity: string; chance: number }[] {
  const out: { rarity: string; chance: number }[] = [];
  const pattern = /(\d+(?:\.\d+)?)\s*%\s*chance of being (?:an?\s+)?([A-Z][\w ]*?)(?=[,.]| and\b)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const chance = Number(match[1]) / 100;
    const rarity = match[2].trim();
    if (Number.isFinite(chance) && rarity) out.push({ rarity, chance });
  }

  return out;
}

/** The prose before the first table or tabber, as one or two sentences. */
function parseDescription(body: string): string {
  const cut = Math.min(
    ...[body.indexOf('{|'), body.indexOf('<tabber>')]
      .filter((i) => i !== -1)
      .concat(body.length),
  );

  const prose = toPlainText(
    body
      .slice(0, cut)
      // The leading `[[File:…]]` is the drop's artwork, not a sentence.
      .replace(/\[\[File:[^\]]*\]\]/gi, ''),
  );

  // Two sentences: enough to say what it is and where it comes from.
  const sentences = prose.match(/[^.]+\./g) ?? [prose];
  return sentences.slice(0, 2).join(' ').trim();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseGroup(wikitext: string, heading: string, group: DropType['group']): DropType[] {
  const at = wikitext.search(new RegExp(`^==\\s*${heading}\\s*==\\s*$`, 'm'));
  if (at === -1) return [];

  // Runs to the next top-level heading, so "Event Drops" cannot swallow
  // "Daily Wins" below it.
  const rest = wikitext.slice(at + heading.length + 4);
  const nextTop = rest.search(/^==[^=]/m);
  const section = nextTop === -1 ? rest : rest.slice(0, nextTop);

  return subsections(section)
    .map(({ heading: name, body }): DropType => {
      const tables = tableBlocks(body).map((block): DropTable => {
        const rewards = parseTable(block.text);
        return {
          rarity: rarityForTable(body, block.start),
          rewards,
          listed: rewards.reduce((sum, reward) => sum + (reward.chance ?? 0), 0),
        };
      });

      return {
        name: name.trim(),
        slug: slugify(name),
        description: parseDescription(body),
        rarityOdds: parseRarityOdds(body),
        // An empty table is a parse failure and is not shown. A short one is
        // shown with its total stated — see `DropTable.listed`.
        tables: tables.filter((table) => table.rewards.length > 0),
        group,
      };
    })
    .filter((type) => type.description || type.tables.length > 0);
}

/* ---------------------------------- read ---------------------------------- */

interface WikiParseResponse {
  parse?: { wikitext?: { '*'?: string } };
}

export async function getStarrDrops(): Promise<StarrDropData | null> {
  const body = await fetchWikiJson<WikiParseResponse>(WIKI_URL, REVALIDATE_DROPS);
  const wikitext = body?.parse?.wikitext?.['*'];
  if (!wikitext) return null;

  const types = [
    ...parseGroup(wikitext, 'Drop Types', 'core'),
    ...parseGroup(wikitext, 'Event Drops', 'event'),
  ];

  if (types.length === 0) return null;

  return {
    types,
    sourceUrl: 'https://brawlstars.fandom.com/wiki/Starr_Drops',
  };
}
