import { unstable_cache } from 'next/cache';

import { getGameModes, getMaps } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getOfficialBrawlers } from '@/lib/bs-api';
import type { BubbleLang } from '@/lib/bubble-langs';
import { buildGameNames } from '@/lib/game-l10n';

/**
 * Every name the Bubble can show, in one of the game's languages, keyed by
 * `nameKey` of the English name.
 *
 * Shared by the panel's language pack and the app's upgrade plan, so the two
 * spell a brawler or a mode the same way, and one cached build per language
 * serves both.
 */

const DAY = 86_400;

/** The English names the panel can display, from the catalogues it reads. */
async function displayableNames(): Promise<string[]> {
  const [maps, modes, brawlers, official] = await Promise.all([
    getMaps().catch(() => []),
    getGameModes().catch(() => []),
    getBrawlerArtMap().catch(() => new Map()),
    getOfficialBrawlers()
      .then((r) => r.items)
      .catch(() => []),
  ]);
  // Rank league names too, for the panel's bracket chips.
  const names: string[] = ['Star Power', 'Gadget', 'Gear', 'Diamond', 'Mythic', 'Legendary', 'Masters', 'Pro'];
  for (const m of maps) names.push(m.name);
  for (const m of modes) names.push(m.name);
  for (const b of brawlers.values()) {
    names.push(b.name);
    for (const a of [...(b.starPowers ?? []), ...(b.gadgets ?? [])]) names.push(a.name);
  }
  for (const b of official) {
    for (const g of b.gears ?? []) names.push(g.name);
  }
  return names;
}

const cachedNames = unstable_cache(
  async (file: string, locale: string) => buildGameNames(file, locale, await displayableNames()),
  ['bubble-l10n-names-v2'],
  { revalidate: DAY },
);

export function bubbleGameNames(lang: BubbleLang): Promise<Record<string, string>> {
  return cachedNames(lang.file, lang.code);
}
