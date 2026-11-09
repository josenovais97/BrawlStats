import 'server-only';

import { bubbleGameNames } from '@/lib/bubble-game-names';
import { bubbleLang } from '@/lib/bubble-langs';
import { nameKey, titleCaseIn } from '@/lib/game-l10n';

/**
 * Brawler, mode and rank names in the Bubble app's language (1.40), for the
 * app's widgets and notifications, which have no panel page to translate them.
 * The same dictionary the panel uses; English falls back to calm title case
 * ("MR. P" -> "Mr. P").
 */
export async function appNames(code: string | null | undefined): Promise<(english: string) => string> {
  const lang = bubbleLang(code ?? 'en');
  const names = lang && lang.code !== 'en' ? await bubbleGameNames(lang).catch(() => ({}) as Record<string, string>) : {};
  const locale = lang?.code ?? 'en';
  return (english: string) => {
    const local = names[nameKey(english)];
    return titleCaseIn(local ?? english, local ? locale : 'en');
  };
}

/** "Mythic II" with "Mythic" in the app's language and the numeral kept. */
export function localRank(rank: string | null | undefined, name: (english: string) => string): string | null {
  if (!rank) return null;
  const parts = rank.split(' ');
  const numeral = parts.length > 1 && /^[IV]+$/.test(parts[parts.length - 1]) ? parts.pop() : null;
  const word = name(parts.join(' '));
  return numeral ? `${word} ${numeral}` : word;
}
