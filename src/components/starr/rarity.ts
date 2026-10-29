import type { T } from '@/lib/t';

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

/**
 * The Starr Drop in each rarity's colour.
 *
 * In the game the drop itself changes colour as it upgrades -- green, blue,
 * purple, red, gold -- so the ladder shows the one gold artwork turned to each.
 * A hue rotation of our own copy rather than five downloaded images: there is
 * one asset to keep, and a rarity the game adds later still gets a drop.
 */
export const RARITY_TINT: Record<string, string> = {
  Rare: 'hue-rotate(75deg) saturate(1.2)',
  'Super Rare': 'hue-rotate(165deg) saturate(1.3)',
  Epic: 'hue-rotate(235deg) saturate(1.2)',
  Mythic: 'hue-rotate(310deg) saturate(1.5)',
};

/** "Skin 80-149 Gem" is a skin worth 80 to 149 gems; the rest read as the wiki writes them. */
export function dropRewardName(reward: { reward: string; amount: string | null; label: string }, t: T): string {
  const skin = reward.reward.match(/^Skin (\d+-\d+) Gem$/i);
  if (skin) return t('{n}-gem skin', { n: skin[1] });
  return `${reward.amount ? `${reward.amount} ` : ''}${t(reward.label)}`;
}
