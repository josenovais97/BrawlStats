import { slugify } from '@/lib/slugs';
import {
  WIKI_API,
  balancedTemplate,
  fetchWikiJson,
  firstPage,
  leadQuote,
  parseInfobox,
  subsections,
  toPlainText,
  type WikiPage,
  type WikiPagesResponse,
} from '@/lib/wiki';

export { wikiPageUrl } from '@/lib/wiki';

/**
 * Brawler combat stats and resolved ability text, from the community wiki.
 *
 * This exists because the numbers are not published anywhere else. The
 * official API's brawler catalogue is names and ids only — no health, no
 * damage, no reload — which is why `lib/catalog` can detect a new gadget but
 * never a balance change. The artwork mirror does carry ability descriptions,
 * but with the game's own placeholders left unresolved: it ships
 * "Edgar receives <!card.value1>% more healing", where the wiki has
 * "Edgar receives 30% more healing".
 *
 * One page per brawler, fetched on demand and cached hard. Bulk fetching all
 * hundred-odd would be a single 2.7MB response that no cache layer wants, and
 * a brawler page only ever needs its own.
 *
 * Everything here degrades to null. A restructured page, a renamed template or
 * an unreachable wiki costs the sections that depend on it, never the page.
 * Wiki text is CC-BY-SA and is attributed wherever it is rendered.
 */

/**
 * Stats change only on balance patches, but patch day is when being wrong
 * matters most, so this is sized to the page that renders it rather than to
 * how often the numbers move. Kept in step with the brawler page's own
 * revalidate: a fetch TTL shorter than the page cache above it buys nothing.
 */
const REVALIDATE_WIKI = 21_600;

export interface BrawlerStats {
  /**
   * Class and rarity, as a fallback.
   *
   * The artwork mirror reports `class: "Unknown"` for every brawler released
   * since Meeple — twenty of them — while the wiki infobox has the real value.
   * Free to take: the page is already fetched for the combat stats.
   */
  className: string | null;
  rarityName: string | null;
  health: string | null;
  /** The infobox labels this per brawler — "Damage per shell", "Healing". */
  attackLabel: string | null;
  attack: string | null;
  superLabel: string | null;
  super: string | null;
  reload: string | null;
  movementSpeed: string | null;
  attackRange: string | null;
}

export interface WikiAbility {
  /** The in-game description, with its numbers filled in. */
  description: string | null;
  /** What this ability's buffie does, when one exists. */
  buffie: string | null;
}

/** One line of a brawler's balance history. */
export interface BalanceChange {
  /** ISO date. */
  date: string;
  kind: 'Buff' | 'Nerf' | 'Neutral';
  text: string;
}

export interface BrawlerWiki {
  /** Wiki page title, for attribution links. */
  title: string;
  stats: BrawlerStats;
  /** Keyed by slugged ability name, covering gadgets and star powers. */
  abilities: Map<string, WikiAbility>;
  hypercharge: (WikiAbility & { name: string }) | null;
  /** Balance changes, newest first. */
  history: BalanceChange[];
}

/**
 * The first value of a multi-value infobox field.
 *
 * Several fields list conditional variants — movement speed is
 * "770 (Fast)<br>924 (with Hypercharge)<br>2400 (with Fast Forward)" — and the
 * base value is the one worth showing. The rest depend on a loadout the reader
 * has not told us about.
 */
function firstValue(value: string | undefined): string | null {
  if (!value) return null;
  const text = toPlainText(value.split(/<br\s*\/?>/i)[0]);
  return text || null;
}

/**
 * The buffie description inside a section.
 *
 * The wiki writes it as a second quote tagged with the buffie type —
 * `{{Quote|…}}{{Buffie|Star}}` — so the quote *preceding* the tag is the one
 * that describes the buffie, not the ability itself.
 */
function buffieQuote(section: string): string | null {
  const tag = /\{\{Buffie\|\w+\}\}/.exec(section);
  if (!tag) return null;

  const before = section.slice(0, tag.index);
  const at = before.lastIndexOf('{{Quote|');
  if (at === -1) return null;

  const block = balancedTemplate(before, at);
  if (!block) return null;
  return toPlainText(block.slice('{{Quote|'.length, -2)) || null;
}

/**
 * Parses the balance history.
 *
 * The section is a date-headed list of tagged changes:
 *
 *   *21/05/18:
 *   **{{Balance|Buff|Shelly's health was increased to 3600 (from 3200).}}
 *
 * This is the one thing on the site that answers "was my brawler nerfed", and
 * it is flatly impossible from the game API — the catalogue publishes names and
 * ids, so `lib/catalog` can see a gadget appear but never a number change.
 *
 * Dates are `DD/MM/YY`, which is unambiguous here only because the day always
 * leads; a two-digit year is read as 20YY, the game having launched in 2017.
 */
const COSMETIC_CHANGE =
  /\b(skin|pin|spray|emote|profile icon|voice ?line|remodel)/i;

function parseHistory(wikitext: string): BalanceChange[] {
  const start = wikitext.indexOf('==History==');
  if (start === -1) return [];
  const end = wikitext.indexOf('\n==', start + 5);
  const section = wikitext.slice(start, end === -1 ? undefined : end);

  const out: BalanceChange[] = [];
  let date: string | null = null;

  for (const line of section.split('\n')) {
    const heading = /^\*\s*(\d{2})\/(\d{2})\/(\d{2}):/.exec(line);
    if (heading) {
      date = `20${heading[3]}-${heading[2]}-${heading[1]}`;
      continue;
    }

    const change = /\{\{Balance\|(Buff|Nerf|Neutral)\|/.exec(line);
    if (!change || !date) continue;

    const block = balancedTemplate(line, change.index);
    if (!block) continue;

    const body = block.slice(change.index === 0 ? change[0].length : change[0].length, -2);
    const text = toPlainText(body);
    if (!text) continue;

    const kind = change[1] as BalanceChange['kind'];
    // Cosmetic releases are filed in the same list and are not balance
    // changes: "The Cyber Shelly skin was added" tells a reader nothing about
    // whether the brawler got stronger. Only ever dropped from Neutral rows —
    // a Buff or Nerf mentioning a skin is a real change to one.
    if (kind === 'Neutral' && COSMETIC_CHANGE.test(text)) continue;

    out.push({ date, kind, text });
  }

  // The wiki lists oldest first; a reader wants the most recent change.
  return out.reverse();
}

function parseHypercharge(wikitext: string): (WikiAbility & { name: string }) | null {
  const match = /^==\s*Hypercharge:\s*([^=]+?)\s*==$/m.exec(wikitext);
  if (!match) return null;

  const start = match.index + match[0].length;
  const end = wikitext.indexOf('\n==', start);
  const body = wikitext.slice(start, end === -1 ? undefined : end);

  return {
    name: match[1].trim(),
    description: leadQuote(body),
    buffie: buffieQuote(body),
  };
}

/* --------------------------------- fetching -------------------------------- */

async function fetchPage(name: string): Promise<WikiPage | null> {
  const body = await fetchWikiJson<WikiPagesResponse>(
    `${WIKI_API}?action=query&prop=revisions&rvslots=main&rvprop=content` +
      `&format=json&redirects=1&titles=${encodeURIComponent(name)}`,
    REVALIDATE_WIKI,
  );
  return firstPage(body);
}

/**
 * Everything the wiki knows about one brawler.
 *
 * `name` is the brawler's name as the game reports it; the API's `redirects=1`
 * resolves the spelling differences between sources ("Jae-Yong" to "Jae-yong").
 */
export async function getBrawlerWiki(name: string): Promise<BrawlerWiki | null> {
  const page = await fetchPage(name);
  if (!page) return null;

  const { wikitext } = page;
  const box = parseInfobox(wikitext);

  const abilities = new Map<string, WikiAbility>();
  for (const { heading, body } of subsections(wikitext)) {
    // Only sections that actually tag an ability. Cosmetics and strategy
    // subsections share the same heading level and must not be picked up.
    if (!/\{\{(Gadget|StarPower)\|/.test(body)) continue;
    abilities.set(slugify(heading), {
      description: leadQuote(body),
      buffie: buffieQuote(body),
    });
  }

  const stats: BrawlerStats = {
    className: firstValue(box.Class),
    rarityName: firstValue(box.Rarity),
    health: firstValue(box.Health),
    attackLabel: firstValue(box.AttackLabel),
    attack: firstValue(box.Attack),
    superLabel: firstValue(box.SuperLabel),
    super: firstValue(box.Super),
    reload: firstValue(box.Reload),
    movementSpeed: firstValue(box.MovementSpeed),
    attackRange: firstValue(box.AttackRange),
  };

  const hypercharge = parseHypercharge(wikitext);
  const history = parseHistory(wikitext);

  // A page that yielded nothing usable is reported as nothing, so callers do
  // not have to distinguish "fetched but empty" from "not fetched".
  if (!stats.health && abilities.size === 0 && !hypercharge && history.length === 0) {
    return null;
  }

  return { title: page.title, stats, abilities, hypercharge, history };
}

/**
 * What each gear does, keyed by slugged gear name.
 *
 * The official catalogue names a brawler's gears but never says what any of
 * them does, which left the gear list on a brawler page as six bare words.
 * One page covers the whole game, so this is a single cached request shared by
 * every brawler rather than anything per-brawler.
 *
 * Keyed on the name with "Gear" stripped, because the catalogue says "SPEED"
 * where the wiki heading says "Speed Gear".
 */
export async function getGearDescriptions(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const page = await fetchPage('Gears');
  if (!page) return out;

  for (const { heading, body } of subsections(page.wikitext)) {
    if (!/\{\{Gear\|/.test(body)) continue;
    const description = leadQuote(body);
    if (!description) continue;
    out.set(slugify(heading.replace(/\s*Gears?\s*$/i, '')), description);
  }

  return out;
}
