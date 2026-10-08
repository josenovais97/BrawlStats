import Image from 'next/image';
import Link from 'next/link';

import { TrophyIcon, WinStreakIcon } from '@/components/game-icons';
import { Panel } from '@/components/ui/panel';
import { brawlerModelUrl, brawlerPortraitUrl, hasBrawlerModel } from '@/lib/brawlapi';
import { formatNumber, titleCase } from '@/lib/format';
import {
  HIGHEST_KNOWN_MARK,
  HOT_STREAK,
  closestPrestige,
  mains,
  nextPrestige,
  onFire,
  prestigeOf,
  skinLabel,
} from '@/lib/player-showcase';
import { getSkinArt, skinArtUrl } from '@/lib/skin-art';
import { brawlerPath } from '@/lib/slugs';
import type { BABrawler } from '@/types/brawlapi';
import type { BSPlayerBrawler } from '@/types/brawlstars';

/**
 * The account at a glance, in its own colours: the brawlers it is built
 * around, drawn in the skins actually equipped, then what is hot and what is
 * nearly there.
 *
 * Everything here was already in the player payload -- the equipped skin, the
 * live win streak and the prestige level arrive on every brawler -- and the
 * profile used them as a count, a figure on a tile and a two-letter chip. A
 * reader opening a profile wants to see *their* brawlers looking like *their*
 * brawlers, and that is the one thing the page did not show.
 *
 * Streamed behind its own Suspense boundary by the page: the skin art comes
 * from one cached sweep of the wiki, and on the first view of a day that
 * sweep must never hold up the rest of the profile.
 */
export async function PlayerShowcase({
  brawlers,
  brawlerMeta,
}: {
  brawlers: BSPlayerBrawler[];
  brawlerMeta: Map<number, BABrawler>;
}) {
  if (brawlers.length === 0) return null;

  const top = mains(brawlers);
  const hot = onFire(brawlers);
  const close = closestPrestige(brawlers);

  const [skinArt, models] = await Promise.all([
    getSkinArt().catch(() => ({}) as Record<string, string>),
    Promise.all(top.map((b) => hasBrawlerModel(b.id).catch(() => false))),
  ]);

  // The equipped skin first, then the brawler's own model, then the portrait.
  // A default skin has no wiki file of its own, so it goes straight to the
  // model -- which is exactly what the default skin looks like.
  const artFor = (b: BSPlayerBrawler, i: number): string => {
    const label = skinLabel(b);
    const skin = label ? skinArtUrl(skinArt, b.name, label) : null;
    if (skin) return skin;
    if (models[i]) return brawlerModelUrl(b.id);
    return brawlerMeta.get(b.id)?.imageUrl ?? brawlerPortraitUrl(b.id);
  };

  return (
    <Panel title="Showcase" aside="The brawlers this account is built around">
      {/* The mains. Three cards, each in its rarity's colour, so the row reads
          as three different brawlers rather than three copies of one card.

          Always one row of three. Stacked on a phone they were three tall
          cards and a screen and a half of scrolling before anything else;
          side by side they are compact there and full-size from @xl up. */}
      <ul className="grid grid-cols-3 gap-2 @xl:gap-3">
        {top.map((b, i) => {
          const tint = brawlerMeta.get(b.id)?.rarity.color ?? 'var(--brand)';
          const label = skinLabel(b);
          const target = nextPrestige(b);
          const streak = b.currentWinStreak ?? 0;
          return (
            <li key={b.id}>
              <Link
                href={brawlerPath(b.id, b.name)}
                prefetch={false}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border transition-colors hover:border-brand/50"
                style={{
                  background: `linear-gradient(160deg, color-mix(in srgb, ${tint} 26%, transparent), var(--surface) 70%)`,
                }}
              >
                <span className="absolute left-2 top-2 z-10 rounded-md bg-background/70 px-1.5 py-0.5 text-[10px] font-black text-brand backdrop-blur @xl:left-3 @xl:top-3 @xl:px-2 @xl:text-xs">
                  #{i + 1}<span className="hidden @xl:inline"> main</span>
                </span>
                {prestigeOf(b) > 0 ? (
                  <span
                    className="absolute right-2 top-2 z-10 rounded-md bg-surface-3 px-1 py-0.5 text-[10px] font-black text-accent @xl:right-3 @xl:top-3 @xl:px-1.5 @xl:text-xs"
                    title={`Prestige ${prestigeOf(b)}`}
                  >
                    P{prestigeOf(b)}
                  </span>
                ) : null}

                <div className="relative flex h-28 items-end justify-center pt-6 @xl:h-44">
                  <Image
                    src={artFor(b, i)}
                    alt=""
                    width={176}
                    height={176}
                    className="h-24 w-auto object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)] transition-transform group-hover:scale-105 @xl:h-40"
                    unoptimized
                  />
                </div>

                <div className="flex flex-1 flex-col gap-1.5 p-2.5 pt-2 @xl:gap-2 @xl:p-4 @xl:pt-3">
                  <div className="min-w-0">
                    <p className="display truncate text-sm uppercase @xl:text-xl">{titleCase(b.name)}</p>
                    <p className="truncate text-[10px] text-muted @xl:text-xs">
                      {label ? titleCase(label) : 'Default skin'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs @xl:text-sm">
                    <span className="flex items-center gap-1 font-black tabular-nums text-brand @xl:gap-1.5">
                      <TrophyIcon className="size-3.5 @xl:size-4" />
                      {formatNumber(b.trophies)}
                    </span>
                    {/* Same bar as "On fire": a streak of one is just the last game. */}
                    {streak >= HOT_STREAK ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold tabular-nums text-victory @xl:text-xs">
                        <WinStreakIcon className="size-3.5 @xl:size-4" />
                        {streak}<span className="hidden @xl:inline"> in a row</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Towards the next prestige, or the fact that it is past the
                      last one the data shows. */}
                  {target ? (
                    <div className="mt-auto">
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${Math.max(4, Math.round(target.progress * 100))}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-muted @xl:text-[11px]">
                        {formatNumber(target.toGo)} to P{target.level}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-auto text-[10px] text-muted @xl:text-[11px]">
                      Past {formatNumber(HIGHEST_KNOWN_MARK)}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {hot.length > 0 || close.length > 0 ? (
        <div
          className={`mt-4 grid gap-3 ${hot.length > 0 && close.length > 0 ? '@2xl:grid-cols-2' : ''}`}
        >
          {/* Live streaks: the one number on a brawler that is true tonight
              rather than ever. */}
          {hot.length > 0 ? (
            <div className="rounded-xl bg-surface-2/40 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <WinStreakIcon className="size-4" />
                On fire right now
              </h3>
              <ul className="flex flex-wrap gap-2">
                {hot.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={brawlerPath(b.id, b.name)}
                      prefetch={false}
                      className="flex items-center gap-2 rounded-xl border border-border bg-surface px-2 py-1.5 transition-colors hover:border-victory/50"
                    >
                      <Image
                        src={brawlerMeta.get(b.id)?.imageUrl ?? brawlerPortraitUrl(b.id)}
                        alt=""
                        width={32}
                        height={32}
                        className="size-8 rounded-lg"
                        unoptimized
                      />
                      <span className="text-sm font-semibold">{titleCase(b.name)}</span>
                      <span className="text-sm font-black tabular-nums text-victory">
                        {b.currentWinStreak}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted">Wins in a row, as of the latest battle.</p>
            </div>
          ) : null}

          {/* Nearly there: inside the last quarter of a 1,000-trophy band. */}
          {close.length > 0 ? (
            <div className="rounded-xl bg-surface-2/40 p-4">
              <h3 className="mb-3 text-sm font-bold">Next prestige</h3>
              <ul className="space-y-2.5">
                {close.map((t) => (
                  <li key={t.brawler.id}>
                    <Link
                      href={brawlerPath(t.brawler.id, t.brawler.name)}
                      prefetch={false}
                      className="flex items-center gap-3 rounded-lg transition-colors hover:text-foreground"
                    >
                      <Image
                        src={brawlerMeta.get(t.brawler.id)?.imageUrl ?? brawlerPortraitUrl(t.brawler.id)}
                        alt=""
                        width={32}
                        height={32}
                        className="size-8 shrink-0 rounded-lg"
                        unoptimized
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-semibold">{titleCase(t.brawler.name)}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted">
                            <span className="font-black text-accent">{formatNumber(t.toGo)}</span>{' '}
                            to P{t.level}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${Math.round(t.progress * 100)}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
