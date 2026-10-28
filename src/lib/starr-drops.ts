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
  /** The leading quantity, split off so it can be set as a figure: "50". */
  amount: string | null;
  /** What the quantity is of: "Coins". Equals `reward` when there is none. */
  label: string;
  /**
   * The `{{Icon|…}}` name the wiki tagged this row with, e.g. "Coin".
   *
   * Kept as the wiki's own name rather than resolved here: the artwork is
   * chosen at render time, where local assets beat remote ones and a missing
   * icon can fall back to its category. Stripping this was why every row on
   * the first version of the page was a line of text.
   */
  icon: string | null;
  /** Artwork for `icon`, resolved to a real URL. Null when nothing matched. */
  iconUrl: string | null;
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
  /** The drop's own artwork, resolved from the wiki's `[[File:…]]`. */
  imageUrl: string | null;
  /** One or two sentences of plain prose. */
  description: string;
  /** Chance of the drop rolling each rarity, 0–1. Empty when not stated. */
  rarityOdds: { rarity: string; chance: number }[];
  tables: DropTable[];
  /** Which heading it came from: the permanent drops, the event ones, or boxes. */
  group: 'core' | 'event' | 'box';
  /** Boxes only: the last day the wiki's history says it was added, ISO. */
  addedAt?: string | null;
  /** Boxes only: this season's Daily Wins can give it, so it is live now. */
  inDailyWins?: boolean;
}

/** One reward slot of a Daily Wins row: one icon, or two for a double drop. */
export interface DailyCell {
  items: { name: string; amount: string | null; iconUrl: string | null }[];
  /** The wiki footnoted this slot, e.g. "Only for new players." */
  footnote: boolean;
}

export interface DailySchedule {
  /** How many wins a day pay out, from the wiki's own sentence. */
  wins: number | null;
  /** "Normal Days", "Lucky Days", ... each with the rows it can roll. */
  days: { name: string; rows: DailyCell[][] }[];
  /** The text of the footnote, when any slot carries one. */
  footnote: string | null;
  /** Dated one-off days, newest first. */
  special: { startsAt: string; endsAt: string; cells: DailyCell[] }[];
}

export interface StarrDropData {
  types: DropType[];
  /** What each daily win gives this season, read from the same page. */
  daily: DailySchedule | null;
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
/** The `{{Icon|Coin}}` a row is tagged with, before the markup is stripped. */
function rewardIcon(cell: string): string | null {
  const match = cell.match(/\{\{\s*Icon\s*\|\s*([^}|]+?)\s*\}\}/i);
  return match ? match[1] : null;
}

/**
 * Splits "50 Coins" into a figure and a thing.
 *
 * Worth doing because it is the difference between a row of sentences and a
 * row of numbers: set as a figure, the quantity lines up down the column and
 * the eye can compare it. Ranges ("100-300 XP Doublers") count as one figure.
 * A reward with no leading quantity — "Epic Brawler" — keeps its whole name.
 */
function splitAmount(reward: string): { amount: string | null; label: string } {
  const match = reward.match(/^([\d,]+(?:\s*-\s*[\d,]+)?)\s+(.+)$/);
  return match
    ? { amount: match[1].replace(/\s+/g, ''), label: match[2] }
    : { amount: null, label: reward };
}

function cleanReward(cell: string): string {
  const withoutCollapsed = cell.replace(
    /<div class="mw-collapsible-content"[\s\S]*/i,
    '',
  );

  return (
    toPlainText(withoutCollapsed)
      .replace(/\s{2,}/g, ' ')
      /*
       * A row that can pay out in more than one rarity writes both marks
       * separated by a slash — `{{Icon|Rare skin}}/{{Icon|Super Rare skin}}
       * Skin 30-79 Gem` — so removing the templates leaves the separator
       * stranded at the front, and the reward rendered as "/ Skin 30-79 Gem".
       * The label is what survives the marks, not the punctuation between them.
       */
      .replace(/^[^\p{L}\p{N}(]+/u, '')
      .trim()
  );
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

    rewards.push({
      reward,
      ...splitAmount(reward),
      icon: rewardIcon(cells[0]),
      // Filled in once every image on the page is resolved together.
      iconUrl: null,
      chance: parseChance(cells.slice(1).join('||')),
    });
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

/**
 * Artwork for a reward, in order of preference.
 *
 * Local first. `public/icons` already holds proper transparent PNGs for the
 * resources that make up most of every table — coins, power points, XP — and
 * they load from our own origin at a size chosen for this use. Reaching for
 * the wiki's copy of an asset we already ship would be slower and worse.
 *
 * Gadget is the one exception that is neither: Brawlify publishes a
 * representative gadget asset that `game-icons.tsx` already uses as the
 * generic mark, and matching it here keeps one idea looking like one idea
 * across the site.
 *
 * The rest are wiki file *names* rather than URLs, because the URL is
 * content-hashed and would rot the first time someone re-uploads the image.
 * They resolve through the same batched call as the drop artwork.
 */
const LOCAL_ICON: Record<string, string> = {
  Gadget: 'https://cdn.brawlify.com/gadgets/borderless/23000255.png',
  Coin: '/icons/coin.png',
  'Power Point': '/icons/power-point.png',
  'XP Doubler': '/icons/experience.png',
  Hypercharge: '/icons/hypercharge.png',

  /*
   * Skins by rarity, because the rarity is the whole point of the row.
   *
   * A Legendary skin and a Rare skin are wildly different rewards and the
   * table already sets them apart by chance — one generic hanger on both said
   * only "a skin", which is the least interesting half of the answer. These
   * are the game's own coloured marks, so the colour carries the rarity before
   * the label is read. The Hypercharge one is the same hanger inside a flame.
   */
  'Rare skin': '/icons/skin-rare.png',
  'Super Rare skin': '/icons/skin-super-rare.png',
  'Epic skin': '/icons/skin-epic.png',
  'Mythic skin': '/icons/skin-mythic.png',
  'Legendary skin': '/icons/skin-legendary.png',
  'Hypercharge skin': '/icons/skin-hypercharge.png',
  Buffie: '/icons/buffie.png',
  // The game's own profile-icon tile. `cosmetics.png` is the clothes-hanger
  // mark for skins, which is a different reward entirely.
  'Profile Icon': '/icons/profile-icon.png',
  Trophy: '/icons/trophy.png',
};

const WIKI_ICON: Record<string, string> = {
  // "Chaos Drop.png" is the grey, colourless drop; the schedule showed it
  // as a dark smudge. The Rare one is the art the wiki's own section uses.
  'Chaos Drop': 'Rare Chaos Drop.png',
  Credit: 'Icon-Credit.png',
  Bling: 'Bling.png',
  Gem: 'Icon-Gem.png',
  Mutation: 'Mutation.png',
  'Pro Pass XP': 'Pro Pass XP.png',
  'Star Power': 'Star Power.png',
  Spray: 'Sprays.png',
};

/**
 * Whole families share one mark.
 *
 * The wiki distinguishes a Rare Brawler from a Legendary Brawler in the icon
 * name, but there is no separate artwork for them and the rarity is already
 * in the row's own label — so every `… Brawler` gets the brawler mark, every
 * `… skin` the skin mark, every `… Pin` the pin. Checked after the exact maps,
 * so "Hypercharge skin" still gets its own icon.
 */
function familyIcon(icon: string): { local?: string; wiki?: string } | null {
  if (/\bBrawler$/i.test(icon)) return { local: '/icons/brawlers.png' };
  // Catches anything the exact map above does not, such as "Skin Upgrade" and
  // any rarity the game adds later.
  if (/\bskins?$/i.test(icon) || icon === 'Skin Upgrade') return { local: '/icons/skins.png' };
  if (/\bPin$/i.test(icon)) return { wiki: 'Pin.png' };
  if (/drop$|\bEgg$|\bBox$|\bPresent$|\bRoll$|\bMeal$|\bPack$/i.test(icon)) return { wiki: `${icon}.png` };
  return null;
}

/** The `[[File:Starr Drop.png|right|110px]]` a section opens with. */
function artworkFile(body: string): string | null {
  const match = body.match(/\[\[File:([^|\]]+?\.(?:png|jpg|gif))/i);
  return match ? match[1].trim() : null;
}

/**
 * Turns wiki file names into image URLs, in as few requests as the API allows.
 *
 * `[[File:Starr Drop.png]]` is a *name*, not an address — the real URL is a
 * content-hashed path on the wiki's CDN. The API resolves them in bulk, so
 * thirteen drop types cost one call rather than thirteen, and a failure here
 * costs artwork rather than the page.
 */
async function resolveArtwork(files: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(files)];
  if (unique.length === 0) return out;

  // The API takes 50 titles a request; with the boxes the page needs more.
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += 50) batches.push(unique.slice(i, i + 50));

  const bodies = await Promise.all(
    batches.map((batch) =>
      fetchWikiJson<{
        query?: { pages?: Record<string, { title?: string; imageinfo?: { url?: string }[] }> };
      }>(
        `${WIKI_API}?action=query&titles=${encodeURIComponent(
          batch.map((file) => `File:${file}`).join('|'),
        )}&prop=imageinfo&iiprop=url&format=json`,
        REVALIDATE_DROPS,
      ),
    ),
  );

  for (const body of bodies) {
    for (const page of Object.values(body?.query?.pages ?? {})) {
      const name = page.title?.replace(/^File:/, '');
      const src = page.imageinfo?.[0]?.url;
      if (name && src) out.set(name, src);
    }
  }

  return out;
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
        // Filled in once every file on the page has been resolved together.
        imageUrl: artworkFile(body),
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

/* ---------------------------------- boxes --------------------------------- */

/**
 * The wiki's box pages, read the same way as the drops (2026-10-22).
 *
 * Boxes came back to the game as event and new-brawler rewards — a Mega Box
 * voucher went out on 2026-10-21, and this season's Daily Wins can give a
 * Pumpkin Box — but they live on `Boxes/…` subpages, not on the Starr Drops
 * page, so the first version of this page never showed one. Each subpage is
 * a list of `=== X Boxes ===` sections with the same chance tables.
 */
export const BOX_PAGES = ['Boxes/Event Boxes', 'Boxes/Brawler Boxes'] as const;

/** "On 01/09/26, Cosmo Boxes and Vince Boxes were added to the game." */
export function boxAddedDates(wikitext: string, names: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of wikitext.split('\n')) {
    const date = line.match(/^\*\s*On (\d{2})\/(\d{2})\/(\d{2}),/);
    if (!date) continue;
    const iso = `20${date[3]}-${date[2]}-${date[1]}`;
    // Sentence by sentence, so "Mecha Boxes were added. Mega Boxes were
    // added back" dates both, and "X were removed and replaced by Y" dates Y.
    for (const sentence of line.split(/\.\s/)) {
      const added = sentence.search(/\b(?:were|was) added\b/);
      const replaced = sentence.search(/\breplaced by\b/);
      for (const name of names) {
        const at = sentence.indexOf(name);
        if (at === -1) continue;
        if ((added !== -1 && at < added) || (replaced !== -1 && at > replaced)) {
          if ((out.get(name) ?? '') < iso) out.set(name, iso);
        }
      }
    }
  }
  return out;
}

/** "Pumpkin Boxes" -> "Pumpkin Box", the name Daily Wins uses. */
function singular(name: string): string {
  return name.replace(/Boxes$/, 'Box');
}

export function parseBoxes(wikitext: string, dailyIcons: Set<string>): DropType[] {
  const sections = subsections(wikitext).filter(({ body }) => tableBlocks(body).length > 0);
  const names = sections.map(({ heading }) => heading.trim());
  const added = boxAddedDates(wikitext, names);

  return sections
    .filter(({ heading }) => heading.trim() !== 'Fallback Rewards')
    .map(({ heading, body }): DropType => {
      const name = heading.trim();
      const blocks = tableBlocks(body);
      // A box reworked over the years keeps one tab per year ("2025",
      // "2024"), newest first: only the current one is the box you get.
      const yearly = blocks.length > 1 && /^\d{4}$/.test(rarityForTable(body, blocks[0].start) ?? '');
      const tables = (yearly ? blocks.slice(0, 1) : blocks).map((block): DropTable => {
        const rewards = parseTable(block.text);
        return {
          rarity: yearly ? null : rarityForTable(body, block.start),
          rewards,
          listed: rewards.reduce((sum, reward) => sum + (reward.chance ?? 0), 0),
        };
      });
      return {
        name,
        slug: slugify(name),
        imageUrl: artworkFile(body),
        // The sections open on artwork and a table, with no prose to quote;
        // the page says when each was added instead.
        description: '',
        rarityOdds: [],
        tables: tables.filter((table) => table.rewards.length > 0),
        group: 'box',
        addedAt: added.get(name) ?? null,
        inDailyWins: dailyIcons.has(singular(name)),
      };
    })
    .filter((type) => type.tables.length > 0);
}

/* -------------------------------- daily wins ------------------------------- */

function dailyCell(cell: string): DailyCell {
  const footnote = /<ref\b/i.test(cell);
  const clean = cell.replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  const items = [...clean.matchAll(/(?:([\d,]+)\s*)?\{\{\s*Icon\s*\|\s*([^}|]+?)\s*\}\}/gi)].map((m) => ({
    name: m[2],
    amount: m[1] ?? null,
    iconUrl: null,
  }));
  return { items, footnote };
}

/** A table's rows as cells, with the `!` header rows passed through. */
function dailyRows(table: string): ({ header: string } | { cells: string[] })[] {
  const out: ({ header: string } | { cells: string[] })[] = [];
  for (const row of table.split(/\n\|-\s*\n?/)) {
    const line = row.trim();
    if (!line || line.startsWith('{|')) continue;
    if (line.startsWith('!')) {
      out.push({ header: toPlainText(line.replace(/^!+/, '').replace(/^[^|]*\|(?!\|)/, '')).trim() });
      continue;
    }
    out.push({ cells: line.replace(/\n\|/g, '||').replace(/^\|/, '').split('||') });
  }
  return out;
}

/**
 * The Daily Wins section: what each win of the day gives this season.
 *
 * This is the "starr drop schedule" people search for. It was written into
 * the page by hand on 2026-10-09 as "your first 5 wins" and was out of date
 * two weeks later, when the wiki said 6 — so it is read from the wiki now.
 */
export function parseDailyWins(wikitext: string): DailySchedule | null {
  const at = wikitext.search(/^==\s*Daily Wins\s*==\s*$/m);
  if (at === -1) return null;
  const rest = wikitext.slice(at).replace(/^==[^\n]*\n/, '');
  const nextTop = rest.search(/^==[^=]/m);
  const section = nextTop === -1 ? rest : rest.slice(0, nextTop);

  const wins = section.match(/first (\d+) wins/i);
  const footnote = section.match(/<ref[^>/]*>([\s\S]*?)<\/ref>/i);
  const parts = subsections(section);

  const days: DailySchedule['days'] = [];
  const current = parts.find((p) => /current season/i.test(p.heading));
  const currentTable = current && tableBlocks(current.body)[0];
  if (currentTable) {
    for (const row of dailyRows(currentTable.text)) {
      if ('header' in row) days.push({ name: row.header, rows: [] });
      else if (days.length > 0) days[days.length - 1].rows.push(row.cells.map(dailyCell));
    }
  }

  const special: DailySchedule['special'] = [];
  const specialPart = parts.find((p) => /special days/i.test(p.heading));
  const specialTable = specialPart && tableBlocks(specialPart.body)[0];
  if (specialTable) {
    for (const row of dailyRows(specialTable.text)) {
      if ('header' in row || row.cells.length < 2) continue;
      // "April 14, 2026 to \nApril 23, 2026" or a single date.
      const [from, to] = toPlainText(row.cells[0]).split(/\s+to\s+/).map((d) => Date.parse(`${d.trim()} UTC`));
      if (!Number.isFinite(from)) continue;
      special.push({
        startsAt: new Date(from).toISOString(),
        endsAt: new Date(Number.isFinite(to) ? to : from).toISOString(),
        cells: row.cells.slice(1).map(dailyCell),
      });
    }
  }
  special.sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  /*
   * A footnoted slot is a variant ("160 Credits, only for new players") of a
   * row that is otherwise listed in full. The variant is dropped when its
   * twin exists, so the table shows what an established player gets.
   */
  const names = (cell: DailyCell) => cell.items.map((item) => item.name).join('+');
  for (const day of days) {
    day.rows = day.rows.filter(
      (row) =>
        !row.some((cell) => cell.footnote) ||
        !day.rows.some(
          (other) =>
            other !== row &&
            !other.some((cell) => cell.footnote) &&
            other.length === row.length &&
            other.every((cell, i) => row[i].footnote || names(cell) === names(row[i])),
        ),
    );
  }
  const anyFootnote = days.some((d) => d.rows.some((row) => row.some((cell) => cell.footnote)));

  const filled = days.filter((d) => d.rows.length > 0);
  if (filled.length === 0 && special.length === 0) return null;
  return {
    wins: wins ? Number(wins[1]) : null,
    days: filled,
    footnote: footnote && anyFootnote ? toPlainText(footnote[1]).trim() : null,
    special,
  };
}

/* ---------------------------------- odds ---------------------------------- */

/**
 * The chance of at least one hit in `n` independent openings at `p` each.
 *
 * What people actually want to know about a 2% Legendary is not the 2% but
 * "will I get one this week", and the answer is not 7 x the daily figure.
 */
export function atLeastOnce(p: number, n: number): number {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return 1;
  return 1 - (1 - p) ** n;
}

/**
 * How many of `item` a normal day's Daily Wins give this season.
 *
 * A season can roll one of several normal rows ("one of these"), so this is
 * the fewest any of them gives -- the number a player can count on. Null when
 * the wiki lists no normal day, so the page falls back to per-drop odds
 * rather than inventing a daily rate.
 */
export function perNormalDay(daily: DailySchedule | null, item: string): number | null {
  const normal = daily?.days.find((day) => /^normal/i.test(day.name));
  if (!normal || normal.rows.length === 0) return null;
  return Math.min(
    ...normal.rows.map((row) =>
      row.reduce((sum, cell) => sum + cell.items.filter((entry) => entry.name === item).length, 0),
    ),
  );
}

/**
 * The chance of a rarity or anything rarer.
 *
 * The wiki writes a drop's odds from commonest to rarest, so "Legendary or
 * better" on a Chaos Drop is Legendary plus Ultra. Null when the drop has no
 * such rarity, rather than 0, which would claim it can't roll.
 */
export function atOrAbove(odds: { rarity: string; chance: number }[], rarity: string): number | null {
  const at = odds.findIndex((odd) => odd.rarity === rarity);
  if (at === -1) return null;
  return odds.slice(at).reduce((sum, odd) => sum + odd.chance, 0);
}

/** The next special day that has not ended, or null. `special` is newest first. */
export function nextSpecialDay(daily: DailySchedule | null, now: Date): DailySchedule['special'][number] | null {
  const today = now.toISOString().slice(0, 10);
  const upcoming = (daily?.special ?? []).filter((day) => day.endsAt.slice(0, 10) >= today);
  return upcoming.length > 0 ? upcoming[upcoming.length - 1] : null;
}

/* ---------------------------------- read ---------------------------------- */

function localIconPath(icon: string | null): string | null {
  if (!icon) return null;
  return LOCAL_ICON[icon] ?? familyIcon(icon)?.local ?? null;
}

function wikiIconFile(icon: string | null): string | null {
  if (!icon || localIconPath(icon)) return null;
  return WIKI_ICON[icon] ?? familyIcon(icon)?.wiki ?? null;
}

interface WikiParseResponse {
  parse?: { wikitext?: { '*'?: string } };
}

function boxPageUrl(page: string): string {
  return `${WIKI_API}?action=parse&page=${encodeURIComponent(page).replace(/%20/g, '_')}&prop=wikitext&format=json`;
}

export async function getStarrDrops(): Promise<StarrDropData | null> {
  const body = await fetchWikiJson<WikiParseResponse>(WIKI_URL, REVALIDATE_DROPS);
  const wikitext = body?.parse?.wikitext?.['*'];
  if (!wikitext) return null;

  const daily = parseDailyWins(wikitext);
  const dailyIcons = new Set(
    (daily?.days ?? []).flatMap((d) => d.rows.flat().flatMap((cell) => cell.items.map((item) => item.name))),
  );

  // The box pages are extras: one failing costs its boxes, not the page.
  const boxPages = await Promise.all(
    BOX_PAGES.map((page) => fetchWikiJson<WikiParseResponse>(boxPageUrl(page), REVALIDATE_DROPS)),
  );
  const boxes = boxPages
    .flatMap((page) => {
      const text = page?.parse?.wikitext?.['*'];
      return text ? parseBoxes(text, dailyIcons) : [];
    })
    // What this season's Daily Wins can give first, then newest first.
    .sort((a, b) => Number(b.inDailyWins) - Number(a.inDailyWins) || (b.addedAt ?? '').localeCompare(a.addedAt ?? ''));

  const types = [
    ...parseGroup(wikitext, 'Drop Types', 'core'),
    ...boxes,
    ...parseGroup(wikitext, 'Event Drops', 'event'),
  ];

  if (types.length === 0) return null;

  /*
   * One request for every image on the page: the drop artwork and any reward
   * icon we do not ship ourselves. Resolving these per row would be a hundred
   * calls to render one page.
   */
  const dailyItems = [
    ...(daily?.days ?? []).flatMap((d) => d.rows.flat()),
    ...(daily?.special ?? []).flatMap((s) => s.cells),
  ].flatMap((cell) => cell.items);
  // A daily slot names its drop or box; the wiki's file is that name, or
  // its plural ("Smoothie Drops.png").
  const dailyFiles = (name: string): string[] => {
    if (localIconPath(name)) return [];
    const known = wikiIconFile(name);
    return [...(known ? [known] : []), `${name}.png`, `${name}s.png`];
  };

  const wanted = new Set<string>();
  for (const type of types) {
    if (type.imageUrl) wanted.add(type.imageUrl);
    for (const table of type.tables) {
      for (const reward of table.rewards) {
        const file = wikiIconFile(reward.icon);
        if (file) wanted.add(file);
      }
    }
  }
  for (const item of dailyItems) {
    for (const file of dailyFiles(item.name)) wanted.add(file);
  }

  const artwork = await resolveArtwork([...wanted]);

  // `imageUrl` currently holds the file *name*; swap each for its real URL.
  for (const type of types) {
    type.imageUrl = type.imageUrl ? (artwork.get(type.imageUrl) ?? null) : null;
    for (const table of type.tables) {
      for (const reward of table.rewards) {
        const local = localIconPath(reward.icon);
        const file = wikiIconFile(reward.icon);
        reward.iconUrl = local ?? (file ? (artwork.get(file) ?? null) : null);
      }
    }
  }
  for (const item of dailyItems) {
    const found = dailyFiles(item.name).find((file) => artwork.has(file));
    item.iconUrl = localIconPath(item.name) ?? (found ? artwork.get(found)! : null);
  }

  return {
    types,
    daily,
    sourceUrl: 'https://brawlstars.fandom.com/wiki/Starr_Drops',
  };
}
