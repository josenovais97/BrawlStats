import { brawlerIconUrl, brawlerModelUrl, brawlerPortraitUrl, hasBrawlerModel } from '@/lib/brawlapi';
import { skinLabel } from '@/lib/player-showcase';
import { getSkinArt, skinArtUrl, wikiThumb } from '@/lib/skin-art';
import { getWikiModel } from '@/lib/wiki-art';
import type { BABrawler } from '@/types/brawlapi';
import type { BSPlayerBrawler } from '@/types/brawlstars';

/**
 * The best picture of each brawler as this account has it: the equipped skin,
 * then the brawler's own model, then the portrait.
 *
 * The same order the Overview showcase uses, so a brawler looks the same on
 * every tab. A default skin has no wiki file of its own, so it goes straight
 * to the model -- which is exactly what the default skin looks like.
 *
 * One cached wiki sweep and one cached model check per brawler; an unreachable
 * wiki costs the skins, never the page.
 */
export async function brawlerArt(
  brawlers: BSPlayerBrawler[],
  brawlerMeta: Map<number, BABrawler>,
): Promise<Map<number, string>> {
  const [skinArt, models] = await Promise.all([
    getSkinArt().catch(() => ({}) as Record<string, string>),
    Promise.all(brawlers.map((b) => hasBrawlerModel(b.id).catch(() => false))),
  ]);

  const art = new Map<number, string>();
  brawlers.forEach((b, i) => {
    const label = skinLabel(b);
    const skin = label ? skinArtUrl(skinArt, b.name, label) : null;
    art.set(
      b.id,
      skin ??
        (models[i] ? brawlerModelUrl(b.id) : null) ??
        brawlerMeta.get(b.id)?.imageUrl ??
        brawlerPortraitUrl(b.id),
    );
  });
  return art;
}

/**
 * A brawler drawn full-body in its default look, for podiums and face-offs:
 * the mirror's model, then the wiki's full-body render, then the portrait --
 * so two figures side by side never become a figure and a square tile.
 */
export async function fullBodyArt(
  brawlerId: number,
  brawlerName: string,
  portrait?: string | null,
): Promise<string> {
  if (await hasBrawlerModel(brawlerId).catch(() => false)) return brawlerModelUrl(brawlerId);
  const wiki = await getWikiModel(brawlerName).catch(() => null);
  if (wiki) return wikiThumb(wiki, 400);
  return portrait ?? brawlerIconUrl(brawlerId);
}
