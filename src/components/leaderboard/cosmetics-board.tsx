import { CosmeticsIcon, PlayersIcon } from "@/components/game-icons";
import Image from "next/image";
import Link from "next/link";

import { brawlerPath } from "@/lib/slugs";
import { brawlerIconUrl, playerIconUrl } from "@/lib/brawlapi";
import { formatNumber, formatPercent, titleCaseLabel } from "@/lib/format";
import { getIconUsage, getSkinUsage, type CosmeticUsage } from "@/lib/stats";

/**
 * What the sampled population is actually wearing.
 *
 * This is the one board on the site that could not be copied from the game
 * API. The API reports only the skin and icon a player has *equipped* right
 * now, never what they own, so no single response can rank anything — the
 * ranking exists because the sampler records the equipped cosmetic every day
 * and the distribution accumulates.
 *
 * Default skins are excluded from the listing but stay in the denominator, so
 * a share is out of every sampled brawler slot rather than only the dressed
 * ones. See `getSkinUsage`.
 */
export async function CosmeticsBoard() {
  const [skins, icons] = await Promise.all([
    getSkinUsage(24),
    getIconUsage(12),
  ]);

  if (skins.length === 0 && icons.length === 0) {
    return (
      <div className="card card-glow mx-auto max-w-xl p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-accent">
          <CosmeticsIcon className="size-7" />
        </span>
        <h2 className="mt-4 text-xl font-bold">Collecting cosmetics</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Equipped skins and icons are recorded as the sampler works through the
          player pool. This board fills in over the next day or two.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="skins">
        <h2 id="skins" className="display text-2xl uppercase">
          Most worn skins
        </h2>
        <p className="mb-4 mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          Share of sampled brawlers wearing each skin. Default skins are left
          out of the list but still counted in the total, so a 2% share means
          two in every hundred brawlers we saw. Not two in every hundred that
          had a skin on at all.
        </p>

        <ol className="grid gap-2 sm:grid-cols-2">
          {skins.map((skin, index) => (
            <li key={skin.id}>
              <Link
                href={brawlerPath(skin.brawlerId ?? 0, skin.brawlerName)}
                className="row-interactive flex items-center gap-3 rounded-xl p-2.5"
              >
                <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-muted">
                  {index + 1}
                </span>
                <Image
                  src={brawlerIconUrl(skin.brawlerId ?? 0)}
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 shrink-0 rounded"
                  unoptimized
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {titleCaseLabel(skin.name)}
                  </span>
                  <span className="block truncate text-xs capitalize text-muted">
                    {skin.brawlerName?.toLowerCase()}
                  </span>
                </span>
                <Share usage={skin} />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {icons.length > 0 ? (
        <section aria-labelledby="icons">
          <h2 id="icons" className="display text-2xl uppercase">
            Most worn profile icons
          </h2>
          <p className="mb-4 mt-1 max-w-3xl text-sm leading-relaxed text-muted">
            Share of sampled accounts using each icon. Everyone has one, so
            these shares are out of the whole pool.
          </p>

          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {icons.map((icon, index) => (
              <li key={icon.id} className="card flex items-center gap-3 p-2.5">
                <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-muted">
                  {index + 1}
                </span>
                <Image
                  src={playerIconUrl(icon.id)}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-lg bg-surface-2"
                  unoptimized
                />
                <span className="min-w-0 flex-1">
                  <Share usage={icon} />
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted">
          <PlayersIcon className="size-4" />
          Profile icons are still being recorded.
        </p>
      )}
    </div>
  );
}

function Share({ usage }: { usage: CosmeticUsage }) {
  return (
    <span className="shrink-0 text-right">
      <span className="block text-sm font-bold tabular-nums text-brand">
        {formatPercent(usage.share)}
      </span>
      <span className="block text-xs tabular-nums text-muted">
        {formatNumber(usage.users)}
      </span>
    </span>
  );
}
