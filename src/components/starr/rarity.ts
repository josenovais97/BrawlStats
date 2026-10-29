/**
 * How a drop's odds are shown, shared by /starr-drops and the drop section
 * of /rewards (2026-10-29) so the two never disagree on a colour or a digit.
 */

/**
 * Rarity colours.
 *
 * Deliberately the game's own progression rather than the site's tier palette:
 * a reader who plays already knows what colour Legendary is, and borrowing the
 * S-to-D colours here would imply these are rankings rather than rarities.
 */
const RARITY_COLOR: Record<string, string> = {
  Rare: '#5fd45f',
  'Super Rare': '#3ea8ff',
  Epic: '#c05bff',
  Mythic: '#ff4d6d',
  Legendary: '#ffc53d',
  Ultra: '#ff8a3d',
  'Ultra Legendary': '#ff8a3d',
  Angelic: '#ffe9a8',
  Demonic: '#ff5c72',
};

export function rarityColor(rarity: string | null): string {
  return (rarity && RARITY_COLOR[rarity]) || 'var(--accent)';
}

/** "2%", "9.6%", "0.25%": enough digits to tell small chances apart, no more. */
export function pct(chance: number): string {
  const value = chance * 100;
  if (value < 1) return `${value.toFixed(2)}%`;
  if (value < 10) return `${value.toFixed(1).replace(/\.0$/, '')}%`;
  return `${Math.round(value)}%`;
}
