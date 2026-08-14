/**
 * Brawl Stars player/club tags are short base-32-ish codes shown as "#ABC123".
 * The API expects them URL-encoded with the leading hash (`%23ABC123`), while
 * our own routes carry them without the hash to keep URLs readable.
 */

/** Characters Supercell actually uses in tags. Notably excludes I, O, S, B. */
const TAG_ALPHABET = '0289PYLQGRJCUV';

/**
 * Strips "#", uppercases, and maps the digits people commonly mistype.
 * O -> 0 and I -> 1 are safe because neither letter appears in real tags.
 */
export function normalizeTag(input: string): string {
  return input
    .trim()
    .replace(/^#/, '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/I/g, '1');
}

/** True when the tag only uses characters that can appear in a real tag. */
export function isValidTag(tag: string): boolean {
  const t = normalizeTag(tag);
  if (t.length < 3 || t.length > 14) return false;
  return [...t].every((c) => TAG_ALPHABET.includes(c));
}

/** Encodes a tag for the official API path segment: "ABC123" -> "%23ABC123". */
export function encodeTagForApi(tag: string): string {
  return encodeURIComponent(`#${normalizeTag(tag)}`);
}

/** Display form with the leading hash. */
export function displayTag(tag: string): string {
  return `#${normalizeTag(tag)}`;
}

/** Path segment used in our own routes (no hash, no encoding needed). */
export function routeTag(tag: string): string {
  return normalizeTag(tag);
}
