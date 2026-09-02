import Image from 'next/image';
import Link from 'next/link';

import { SectionHeading } from '@/components/ui/section-heading';
import { brawlerIconUrl, modeLabel } from '@/lib/brawlapi';
import { formatNumber, titleCase } from '@/lib/format';
import type { PushOption } from '@/lib/push-now';
import { brawlerPath, slugify } from '@/lib/slugs';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';

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
 */
export function PlayerPushNow({
  options,
  brawlerMeta,
  modeMeta,
}: {
  options: PushOption[];
  brawlerMeta: Map<number, BABrawler>;
  modeMeta: Map<string, BAGameMode>;
}) {
  if (options.length === 0) return null;

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

  return (
    <section className="space-y-3">
      <SectionHeading
        title="Push now"
        subtitle="The best map in the live rotation for the brawlers this account already owns."
      />

      <div className="card card-glow relative overflow-hidden">
        <span className="block h-1 w-full bg-victory" />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(90% 80% at 8% 0%, color-mix(in srgb, var(--victory) 16%, transparent) 0%, transparent 60%)',
          }}
        />

        <div className="relative flex flex-wrap items-center gap-4 p-5 sm:gap-5">
          <Link
            href={brawlerPath(top.brawlerId, top.brawlerName)}
            prefetch={false}
            className="shrink-0 transition-transform hover:scale-105"
          >
            <Image
              src={topArt?.imageUrl ?? brawlerIconUrl(top.brawlerId)}
              alt=""
              width={72}
              height={72}
              className="size-16 rounded-xl bg-surface-2 sm:size-[72px]"
              unoptimized
            />
          </Link>

          <div className="min-w-0 flex-1 basis-56">
            {/* The mode leads, the map follows underneath.
                People think in modes — "I'm going to play some Knockout" — and
                a map name alone asks the reader to remember which mode it
                belongs to before the sentence means anything. The map is still
                named, and still the link, because the recommendation is
                specific to it. */}
            <p className="flex flex-wrap items-center gap-x-2 text-xl font-black leading-tight sm:text-2xl">
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
            </p>
            {/* The raw per-map win rate is deliberately not printed. On a
                fifty-battle cell it reads as "97.9% win rate here", which is
                true of the sample and false about the brawler — and it is the
                first thing a reader would quote. The adjusted figure on the
                right is the claim, and it already carries its own shrinkage. */}
            <p className="mt-1 text-sm text-muted">
              Power {top.power} · {formatNumber(top.trophies)} trophies
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span>{timeLeft(top.endsAt)}</span>
              <span aria-hidden>·</span>
              <span>{formatNumber(top.battles)} sampled battles</span>
              {top.easyPush ? (
                <span className="rounded-full bg-brand/15 px-2 py-0.5 font-semibold text-brand">
                  Low trophies for this account
                </span>
              ) : null}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-3xl font-black tabular-nums text-victory">
              +{((top.adjusted - 0.5) * 100).toFixed(1)}
            </p>
            <p className="text-xs leading-snug text-muted">
              points above
              <br />
              this map&rsquo;s average
            </p>
          </div>
        </div>
      </div>

      {rest.length > 0 ? (
        <ul className="card divide-y divide-border overflow-hidden">
          {rest.map((option) => {
            const mode = modeLabel(modeMeta, option.mode);
            return (
              <li
                key={`${option.mapName}-${option.brawlerId}`}
                className="flex items-center gap-3 px-4 py-2.5"
              >
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
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold">{titleCase(option.brawlerName)}</span>
                    <span className="text-muted">in</span>
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
                    <span className="text-muted">{mode}</span>
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
    </section>
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
