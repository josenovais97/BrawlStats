import { formatNumber, formatPercent } from '@/lib/format';
import type { BrawlerSkinUsage } from '@/lib/stats';

/**
 * What this brawler's owners actually equip.
 *
 * Shares are of the players who own *this* brawler, not of the whole
 * playerbase — "of people who have Shelly" is the only reading that means
 * anything at this scale, and the sitewide cosmetics board answers the other
 * question already.
 *
 * No artwork: neither the metadata API nor the CDN exposes skin images (there
 * is no /v1/skins endpoint and every skin path 404s), so the bars carry the
 * visual weight rather than a grid of broken thumbnails. The numbers are the
 * part nobody else has anyway.
 */
export function BrawlerSkins({
  skins,
  brawlerName,
}: {
  skins: BrawlerSkinUsage[];
  brawlerName: string;
}) {
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
            <span className="font-semibold text-foreground">{formatPercent(dressed)}</span> of
            sampled {name} owners have a skin equipped.
          </>
        ) : (
          <>Almost every sampled {name} owner is on the default skin.</>
        )}{' '}
        Shares are of players who own {name}, from the rotating snapshot sample.
      </p>

      <ul className="card divide-y divide-border overflow-hidden">
        {top.map((skin) => (
          <li key={skin.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold capitalize">
                  {skin.name.toLowerCase()}
                </span>
                {skin.isDefault ? (
                  <span className="shrink-0 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-muted">
                    Default
                  </span>
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
          {skins.length - top.length} rarer{' '}
          {skins.length - top.length === 1 ? 'skin' : 'skins'} not shown.
        </p>
      ) : null}
    </div>
  );
}
