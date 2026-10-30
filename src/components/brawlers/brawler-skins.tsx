import Image from 'next/image';

import { formatNumber, formatPercent } from '@/lib/format';
import type { BrawlerSkinUsage } from '@/lib/stats';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';

/**
 * What this brawler's owners actually equip.
 *
 * Shares are of the players who own *this* brawler, not of the whole
 * playerbase — "of people who have Shelly" is the only reading that means
 * anything at this scale, and the sitewide cosmetics board answers the other
 * question already.
 *
 * Artwork comes from the wiki, which is the only reachable source: there is no
 * /v1/skins endpoint on the metadata API and every cdn.brawlify.com skin path
 * 404s. See lib/skin-art. Around a fifth of skins have no file — usually the
 * newest — so a row without art still renders, with its bar and its numbers.
 *
 * The default skin falls back to the brawler's portrait rather than a blank,
 * because the portrait IS what the default looks like. The page's resolved
 * portrait, not one built from the id: the mirror publishes a new brawler's
 * art days after the brawler, and an id-built URL drew Vince's default skin as
 * a broken image on the week he came out (2026-10-21).
 */
export function BrawlerSkins({
  skins,
  portrait,
  brawlerName,
  artFor,
}: {
  skins: BrawlerSkinUsage[];
  /** The portrait the page itself shows, already past the missing-art fallbacks. */
  portrait: string;
  brawlerName: string;
  /** Resolves a skin to its wiki artwork, or null when the wiki has no file. */
  artFor: (skin: BrawlerSkinUsage) => string | null;
}) {
  const t = getT(requestLocale());
  if (skins.length === 0) return null;

  const name = brawlerName.toLowerCase();
  const top = skins.slice(0, 12);
  const dressed = skins
    .filter((skin) => !skin.isDefault)
    .reduce((sum, skin) => sum + skin.share, 0);

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted">
        {dressed > 0 ? (
          <>
            <span className="font-semibold text-foreground">{formatPercent(dressed)}</span>{' '}{t('of sampled {name} owners have a skin equipped.', { name: name })}</>
        ) : (
          <>{t('Almost every sampled {name} owner is on the default skin.', { name: name })}</>
        )}{' '}{t('Shares are of players who own {name}, from the rotating snapshot sample.', { name: name })}</p>

      <ul className="card divide-y divide-border overflow-hidden">
        {top.map((skin) => (
          <li key={skin.id} className="flex items-center gap-3 px-3 py-2.5">
            <SkinArt src={skin.isDefault ? portrait : artFor(skin)} alt="" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold capitalize">
                  {skin.name.toLowerCase()}
                </span>
                {skin.isDefault ? (
                  <span className="label-game shrink-0 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted">{t('Default')}</span>
                ) : null}
              </span>
              {/* The bar is the comparison; the number beside it is the detail. */}
              <span
                aria-hidden
                className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2"
              >
                <span
                  className={`block h-full rounded-full ${skin.isDefault ? 'bg-muted/50' : 'bg-brand'}`}
                  style={{ width: `${Math.max(skin.share * 100, 1.5)}%` }}
                />
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-bold tabular-nums">
                {formatPercent(skin.share)}
              </span>
              <span className="block text-xs tabular-nums text-muted">
                {formatNumber(skin.users)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {skins.length > top.length ? (
        <p className="text-xs text-muted">
          {skins.length - top.length}{' '}{t('rarer')}{' '}{skins.length - top.length === 1 ? t('skin') : t('skins')}{' '}{t('not shown.')}</p>
      ) : null}
    </div>
  );
}

/**
 * The skin's picture, or a quiet placeholder when the wiki has no file for it.
 *
 * A placeholder rather than a hidden row: the skin is real and its numbers are
 * the point, and dropping it would misrepresent the ranking.
 */
function SkinArt({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <span
        aria-hidden
        className="size-11 shrink-0 rounded-lg border border-dashed border-border bg-surface-2"
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={44}
      height={44}
      className="size-11 shrink-0 rounded-lg bg-surface-2 object-cover"
      loading="lazy"
      unoptimized
    />
  );
}
