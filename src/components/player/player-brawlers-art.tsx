import { PlayerBrawlers, type BrawlerMetaLite } from '@/components/player/player-brawlers';
import { brawlerModelUrl } from '@/lib/brawlapi';
import { skinLabel } from '@/lib/player-showcase';
import { getSkinArt, skinArtUrl } from '@/lib/skin-art';
import type { BSPlayerBrawler } from '@/types/brawlstars';

/**
 * The roster grid with each brawler drawn full-body, in the skin equipped.
 *
 * Streamed: the page renders `PlayerBrawlers` with portraits as this
 * boundary's fallback, and this swaps in the same grid with art once the
 * cached wiki sweep answers. The equipped skin when the wiki has it, else the
 * brawler's model -- unprobed, because a hundred HEAD requests per profile is
 * not worth it when the tile can fall back to the portrait on a 404 itself.
 */
export async function PlayerBrawlersWithArt({
  brawlers,
  meta,
}: {
  brawlers: BSPlayerBrawler[];
  meta: Record<string, BrawlerMetaLite>;
}) {
  const skins = await getSkinArt().catch(() => ({}) as Record<string, string>);

  const withArt: Record<string, BrawlerMetaLite> = { ...meta };
  for (const b of brawlers) {
    const label = skinLabel(b);
    const skin = label ? skinArtUrl(skins, b.name, label) : null;
    const base = meta[b.id];
    if (!base) continue;
    withArt[b.id] = { ...base, artUrl: skin ?? brawlerModelUrl(b.id) };
  }

  return <PlayerBrawlers brawlers={brawlers} meta={withArt} />;
}
