/**
 * Map, mode, brawler and build names in the game's own words, per language.
 *
 * Read from the game's localisation files, which BrawlAPI republishes as
 * `v2/raw/localization/<file>`: one file per language, each a table of text
 * ids (`TID_GOLDRUSH_1`) to strings. English is `texts`. Nothing here is our
 * translation -- a player who sees "Mine hard-rock" on the draft screen sees
 * "Mine hard-rock" in the panel, because both come from the same row.
 *
 * Matching goes through English. The panel only ever knows a name ("Hard Rock
 * Mine", "EL PRIMO"), so the English file is searched for that name's ids and
 * the language file read at those ids. Several ids can share an English
 * string (a brawler's name appears on its card, its unlock screen, its skins
 * menu...); they nearly always agree, and where they differ only in case the
 * mixed-case one is kept, since the all-caps rows are button labels.
 *
 * Keys are `nameKey` -- lowercase letters and digits -- which is also how the
 * battle data's spelling of a map ("Belles Rock") finds the catalogue's
 * ("Belle's Rock").
 */

const RAW = 'https://api.brawlapi.com/v2/raw/localization/';

/** The same normalisation as `mapNameKey`, kept here so the client can import it. */
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

type Column = Map<string, string>;

/** One language's TID -> string column. */
async function loadColumn(file: string): Promise<Column> {
  // `no-store`: each file is ~2 MB, past what the fetch cache will hold, and
  // the reduced dictionary is what gets cached, by the caller.
  const res = await fetch(`${RAW}${file}`, {
    cache: 'no-store',
    headers: { 'user-agent': 'BrawlZone (https://brawlzone.net)' },
  });
  if (!res.ok) throw new Error(`localization/${file} -> ${res.status}`);
  const body = (await res.json()) as { data: Record<string, Record<string, unknown>> };
  const column = new Map<string, string>();
  for (const [tid, row] of Object.entries(body.data)) {
    // The language's column is the one that is neither `id` nor `TID`.
    for (const [key, value] of Object.entries(row)) {
      if (key === 'id' || key === 'TID') continue;
      if (typeof value === 'string' && value.trim()) column.set(tid, value.trim());
    }
  }
  return column;
}

/**
 * Letters that have case, all upper -- a button label rather than a name.
 *
 * Needs at least two cased letters: "ミスターP" has one, in a script without
 * case, and is exactly how the game writes it.
 */
function shouting(text: string, locale: string): boolean {
  const cased = [...text].filter((c) => c.toLocaleLowerCase(locale) !== c.toLocaleUpperCase(locale));
  return cased.length >= 2 && text === text.toLocaleUpperCase(locale);
}

/** "EL COSTO" -> "El Costo", by the language's own casing rules. */
export function titleCaseIn(text: string, locale: string): string {
  return text
    .toLocaleLowerCase(locale)
    .replace(/(^|[\s\-.&/'’(])(\p{L})/gu, (match: string, before: string, letter: string, offset: number, whole: string) =>
      // After an apostrophe, a lone final letter is a contraction or
      // possessive ("Belle's", "don't"), not a word: only "L'Arène" style
      // elisions are capitalised.
      /['’]/.test(before) && !/\p{L}/u.test(whole.charAt(offset + match.length))
        ? match
        : before + letter.toLocaleUpperCase(locale),
    );
}

/** The best of several strings the game uses for one English name. */
export function pickName(candidates: string[], locale: string): string | null {
  if (candidates.length === 0) return null;
  const counts = new Map<string, number>();
  for (const c of candidates) counts.set(c, (counts.get(c) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const calm = ranked.find((c) => !shouting(c, locale));
  return calm ?? titleCaseIn(ranked[0], locale);
}

/**
 * `{ nameKey(english): localised }` for every English name asked for.
 *
 * Names the game has no row for are left out, and the panel shows them in
 * English -- the right outcome for anything that is genuinely ours.
 */
export async function buildGameNames(
  file: string,
  locale: string,
  englishNames: Iterable<string>,
): Promise<Record<string, string>> {
  const wanted = new Set<string>();
  for (const name of englishNames) {
    const key = nameKey(name);
    if (key) wanted.add(key);
  }

  const [english, local] = await Promise.all([loadColumn('texts'), loadColumn(file)]);

  const tidsByKey = new Map<string, string[]>();
  for (const [tid, text] of english) {
    const key = nameKey(text);
    if (!wanted.has(key)) continue;
    const list = tidsByKey.get(key);
    if (list) list.push(tid);
    else tidsByKey.set(key, [tid]);
  }

  const names: Record<string, string> = {};
  for (const [key, tids] of tidsByKey) {
    const picked = pickName(
      tids.map((t) => local.get(t)).filter((s): s is string => Boolean(s)),
      locale,
    );
    if (picked) names[key] = picked;
  }
  return names;
}
