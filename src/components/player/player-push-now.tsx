import Image from 'next/image';
import Link from 'next/link';

import { TrophyIcon } from '@/components/game-icons';
import { Panel } from '@/components/ui/panel';
import { brawlerIconUrl, getMaps, modeLabel } from '@/lib/brawlapi';
import { brawlerArt } from '@/lib/brawler-art';
import { formatNumber, titleCase } from '@/lib/format';
import { skinLabel } from '@/lib/player-showcase';
import type { PushOption } from '@/lib/push-now';
import { brawlerPath, slugify } from '@/lib/slugs';
import type { BABrawler, BAGameMode, BAMap } from '@/types/brawlapi';
import type { BSPlayerBrawler } from '@/types/brawlstars';

/**
 * One decision, then the alternatives.
 *
 * The temptation with a live rotation is to show all fifteen slots, which is
 * the events page and already exists. What is missing is an answer: of the maps
 * up right now, this is the one this account is best equipped for. So the top
 * pick gets a card and the rest get a single line each.
 *
 * The countdown is rendered from the server-known end time rather than ticking.
 * A live timer would make this the only component on a profile that needs
 * JavaScript to stay truthful, and "ends in about 2h" is exactly as useful as
 * "2:14:31" for deciding what to queue.
 *
 * The pick is drawn like the Overview showcase draws the mains: the brawler in
 * the skin this account has equipped, in its rarity colour, beside the map's
 * own layout -- "play this, here" as a picture before it is a sentence. Async
 * for the skin art and the map list, both cached; the page streams it.
 */
export async function PlayerPushNow({
  options,
  brawlers,
  brawlerMeta,
  modeMeta,
}: {
  options: PushOption[];
  /** The account's roster, for the skin the top pick has equipped. */
  brawlers: BSPlayerBrawler[];
  brawlerMeta: Map<number, BABrawler>;
  modeMeta: Map<string, BAGameMode>;
}) {
  if (options.length === 0) return null;

  const owned = brawlers.find((b) => b.id === options[0].brawlerId);
  const [art, maps] = await Promise.all([
    owned ? brawlerArt([owned], brawlerMeta) : Promise.resolve(new Map<number, string>()),
    getMaps().catch(() => [] as BAMap[]),
  ]);

  const [top, ...rest] = options;
  const topMode = modeLabel(modeMeta, top.mode);
  const topArt = brawlerMeta.get(top.brawlerId);
  /*
   * Absent for the newest modes. The artwork source publishes a mode's icon
   * some weeks after the game ships it — Air Hockey, Cooking and Tag Team all
   * have none today, and the wiki has not drawn them either — so the icon is
   * rendered when it exists rather than reserved with a placeholder box.
   */
  const topModeArt = modeMeta.get(top.mode.toLowerCase())?.imageUrl;
  const topMapArt = maps.find(
    (m) => m.name.toLowerCase() === top.mapName.toLowerCase() && !m.disabled,
  )?.imageUrl;
  const tint = topArt?.rarity.color ?? 'var(--victory)';
  const topSkin = owned ? skinLabel(owned) : null;

  return (
    <Panel
      title="Push now"
      subtitle="The best map in the live rotation for the brawlers this account already owns."
      bodyClassName=""
    >
      {/* The pick, as a picture: the brawler in its equipped skin standing in
          its rarity colour, the map it should be played on beside it. */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(120deg, color-mix(in srgb, ${tint} 28%, transparent), var(--surface) 55%, color-mix(in srgb, var(--victory) 14%, transparent))`,
        }}
      >
        <span className="block h-1 w-full bg-victory" />

        <div className="relative flex flex-wrap items-stretch gap-x-5 gap-y-3 px-5 pb-5 sm:flex-nowrap">
          <Link
            href={brawlerPath(top.brawlerId, top.brawlerName)}
            prefetch={false}
            className="group relative flex w-28 shrink-0 items-end justify-center pt-4 sm:w-36"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-1/2 size-32 -translate-x-1/2 rounded-full opacity-45 blur-2xl"
              style={{ background: tint }}
            />
            <Image
              src={art.get(top.brawlerId) ?? topArt?.imageUrl ?? brawlerIconUrl(top.brawlerId)}
              alt=""
              width={144}
              height={144}
              className="relative h-28 w-auto object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-105 sm:h-36"
              unoptimized
            />
          </Link>

          <div className="flex min-w-0 flex-1 basis-52 flex-col justify-center pt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-victory">
              Your best move right now
            </p>
            {/* The mode leads, the map follows underneath.
                People think in modes -- "I'm going to play some Knockout" -- and
                a map name alone asks the reader to remember which mode it
                belongs to before the sentence means anything. */}
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xl font-black leading-tight sm:text-2xl">
              <span>Play {titleCase(top.brawlerName)} in</span>
              <span className="inline-flex items-center gap-1.5">
                {topModeArt ? (
                  <Image
                    src={topModeArt}
                    alt=""
                    width={24}
                    height={24}
                    className="size-6 shrink-0 object-contain"
                    unoptimized
                  />
                ) : null}
                {topMode}
              </span>
            </p>
            <p className="mt-0.5 text-sm">
              <Link
                href={`/maps/${slugify(topMode)}/${slugify(top.mapName)}`}
                prefetch={false}
                className="font-semibold text-brand hover:underline"
              >
                {top.mapName}
              </Link>
              {topSkin ? <span className="text-muted"> · in {titleCase(topSkin)}</span> : null}
            </p>
            {/* The raw per-map win rate is deliberately not printed. On a
                fifty-battle cell it reads as "97.9% win rate here", which is
                true of the sample and false about the brawler -- and it is the
                first thing a reader would quote. The adjusted figure is the
                claim, and it already carries its own shrinkage. */}
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted">
              <span className="rounded-full bg-background/50 px-2 py-0.5 font-semibold text-foreground">
                Power {top.power}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-background/50 px-2 py-0.5 font-semibold text-brand">
                <TrophyIcon className="size-3.5" />
                {formatNumber(top.trophies)}
              </span>
              <span className="rounded-full bg-background/50 px-2 py-0.5">{timeLeft(top.endsAt)}</span>
              {top.easyPush ? (
                <span className="rounded-full bg-brand/15 px-2 py-0.5 font-semibold text-brand">
                  Low trophies for this account
                </span>
              ) : null}
            </p>
            <p className="mt-1.5 text-[11px] text-muted">
              From {formatNumber(top.battles)} sampled battles on this map
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-4 pt-4 max-sm:w-full max-sm:justify-between">
            {/* The map's own layout, when the art source has it: what the
                reader will actually be standing on. */}
            {topMapArt ? (
              <Link
                href={`/maps/${slugify(topMode)}/${slugify(top.mapName)}`}
                prefetch={false}
                className="block shrink-0 overflow-hidden rounded-xl border border-border/70 bg-background/40 transition-transform hover:scale-[1.03]"
                title={top.mapName}
              >
                <Image
                  src={topMapArt}
                  alt={`${top.mapName} layout`}
                  width={96}
                  height={128}
                  className="h-28 w-auto object-contain sm:h-32"
                  unoptimized
                />
              </Link>
            ) : null}
            <div className="text-right">
              <p className="display text-4xl leading-none tabular-nums text-victory">
                +{((top.adjusted - 0.5) * 100).toFixed(1)}
              </p>
              <p className="mt-1 text-xs leading-snug text-muted">
                points above
                <br />
                this map&rsquo;s average
              </p>
            </div>
          </div>
        </div>
      </div>

      {rest.length > 0 ? (
        <ul className="card divide-y divide-border overflow-hidden">
          {rest.map((option, i) => {
            const mode = modeLabel(modeMeta, option.mode);
            return (
              <li
                key={`${option.mapName}-${option.brawlerId}`}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                {/* Numbered from 2: the card above is 1, and the list reads as
                    the queue it is rather than as a table. */}
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-2 text-xs font-black tabular-nums text-muted">
                  {i + 2}
                </span>
                <Image
                  src={brawlerMeta.get(option.brawlerId)?.imageUrl ?? brawlerIconUrl(option.brawlerId)}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 shrink-0 rounded-lg bg-surface-2"
                  loading="lazy"
                  unoptimized
                />
                <span className="min-w-0 flex-1 text-sm">
                  {/*
                    `truncate` on the flex container did nothing -- it sets
                    overflow on the box, and flex children overflow it anyway,
                    so a long mode name was clipped mid-word rather than
                    ellipsised. The children have to say which of them gives
                    way, and it is the mode.
                  */}
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 font-semibold">
                      {titleCase(option.brawlerName)}
                    </span>
                    <span className="shrink-0 text-muted">in</span>
                    {modeMeta.get(option.mode.toLowerCase())?.imageUrl ? (
                      <Image
                        src={modeMeta.get(option.mode.toLowerCase())!.imageUrl}
                        alt=""
                        width={16}
                        height={16}
                        className="size-4 shrink-0 object-contain"
                        loading="lazy"
                        unoptimized
                      />
                    ) : null}
                    <span className="truncate text-muted">{mode}</span>
                  </span>
                  <Link
                    href={`/maps/${slugify(mode)}/${slugify(option.mapName)}`}
                    prefetch={false}
                    className="block truncate text-xs text-muted transition-colors hover:text-brand"
                  >
                    {option.mapName}
                  </Link>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {timeLeft(option.endsAt)}
                </span>
                <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-victory">
                  +{((option.adjusted - 0.5) * 100).toFixed(1)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Panel>
  );
}

/** Coarse on purpose: the decision does not change between 2h11 and 2h14. */
function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ending now';
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.round(ms / 60_000))}m left`;
}
