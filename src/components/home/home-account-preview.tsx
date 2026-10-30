import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import {
  BattlesIcon,
  HyperchargeIcon,
  Power11Icon,
  TrophyIcon,
} from '@/components/game-icons';
import { getTopMetaBrawlers } from '@/lib/home-meta';
import { SAMPLE_PLAYER_TAG } from '@/lib/site';
import { brawlerPath } from '@/lib/slugs';
import { TIER_COLOR } from '@/lib/tiers';
import { playerLinkRel } from '@/lib/link-rel';
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

/**
 * The flagship section: what BrawlZone actually does with a tag.
 *
 * This replaced a grid of five equal feature cells, which described the
 * product without ever showing it. It is laid out like the profile itself —
 * a header strip, then modules of different weights — because the fastest way
 * to explain a dashboard is to show its shape.
 *
 * Nothing here is invented. The roster module is the *real* current top of the
 * meta, from `getTopMetaBrawlers`, which the snapshot and the tools section
 * also read — one cached query for all three. The other modules carry the
 * profile's real section names, icons and answers, and no numbers at all,
 * because the only honest numbers for an account are that account's own. The
 * button opens a real one.
 */
export async function HomeAccountPreview() {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const top = await getTopMetaBrawlers(4).catch(() => []);

  return (
    <section className="reveal" aria-labelledby="account-preview">
      <div className="mb-6 max-w-2xl">
        <p className="eyebrow text-accent">{t('After you search')}</p>
        <h2 id="account-preview" className="display text-game-stroke mt-2.5 text-2xl sm:text-4xl">{t('Your account, explained')}</h2>
        <p className="mt-3 leading-relaxed text-muted">{t('A Brawl Stars profile is a pile of numbers with no context. BrawlZone reads yours against every player we sample and tells you what it means.')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        {/* The preview itself, shaped like the profile it previews. */}
        <div className="card card-glow overflow-hidden">
          {/* Identity strip: the profile header, without a player in it. */}
          <div className="flex items-center gap-3 border-b border-border bg-surface-2/40 px-4 py-3 sm:px-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-3 font-mono text-sm font-bold text-muted">
              #
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{t('Your tag')}</p>
              <p className="truncate text-xs text-muted">{t('Trophies, club, level and Ranked tier')}</p>
            </div>
            <span className="hidden shrink-0 rounded-lg bg-surface-3 px-2.5 py-1 text-xs font-bold text-muted sm:block">{t('Live')}</span>
          </div>

          <div className="grid gap-px bg-border sm:grid-cols-2">
            <Module
              icon={<TrophyIcon className="size-5" />}
              title={t('Skill score')}
              body={t('Out of 10, weighted toward Ranked — how you play, not how long you have played.')}
            />
            <Module
              icon={<Power11Icon className="size-5" />}
              title={t('Progression')}
              body={t('Account completion, coins invested, and what finishing the rest would cost.')}
            />

            {/* The one module with real data in it: the live top of the meta,
                which is exactly what a roster gets scored against. */}
            <div className="bg-surface p-4 sm:col-span-2 sm:p-5">
              <p className="flex items-center gap-2 text-sm font-bold">{t('Roster vs the meta')}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{t('Every brawler you own, tiered against the list below. Your strong picks, and the ones you are missing.')}</p>

              {top.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {top.map((brawler) => (
                    <li key={brawler.brawlerId}>
                      <Link
                        href={lp(brawlerPath(brawler.brawlerId, brawler.name))}
                        // One of a list: prefetching each would burst past the rate limit -- see site-footer.
                        prefetch={false}
                        className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 py-1 pl-1 pr-2.5 transition-colors hover:border-brand/50"
                        title={t('{name}: meta score {v}', { name: brawler.name, v: brawler.score.toFixed(1) })}
                      >
                        <Image
                          src={brawler.imageUrl}
                          alt=""
                          width={32}
                          height={32}
                          className="size-8 shrink-0 rounded-lg"
                          loading="lazy"
                          unoptimized
                        />
                        <span
                          className="text-xs font-black leading-none"
                          style={{ color: TIER_COLOR[brawler.tier] }}
                        >
                          {brawler.tier}
                        </span>
                        <span className="text-xs font-medium capitalize text-muted">
                          {brawler.name.toLowerCase()}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <Module
              icon={<HyperchargeIcon className="size-5" />}
              title={t('Upgraded but not maxed')}
              body={t('Hypercharges stranded below power 11, cheapest to finish first.')}
            />
            <Module
              icon={<BattlesIcon className="size-5" />}
              title={t('Recent battles')}
              body={t('Your last matches, the maps, and who you keep running into.')}
            />
          </div>
        </div>

        {/* What it is for, in three lines. Borderless on purpose: the panel
            beside it is the thing to look at. */}
        <div className="lg:pl-2 lg:pt-2">
          <ol className="space-y-5">
            {[
              ['Understand your level', 'One score, comparable to everyone we sample.'],
              ['Find roster weaknesses', 'Which of your brawlers the meta has left behind.'],
              ['Decide what to upgrade', 'Where the next coins actually change a match.'],
            ].map(([title, body], index) => (
              <li key={title} className="flex gap-3">
                <span className="display shrink-0 text-lg leading-none text-brand/70">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-bold leading-tight">{t(title)}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">
                    {t(body)}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <Link
            href={lp(`/player/${SAMPLE_PLAYER_TAG}`)}
            rel={playerLinkRel(SAMPLE_PLAYER_TAG)}
            className="group mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-strong/70 bg-surface px-4 text-sm font-bold transition-colors hover:border-brand/60 hover:text-brand"
          >{t('See a complete example')}<ArrowRight className="size-4 duration-200 group-hover:translate-x-0.5 motion-safe:transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** One module of the preview, matching the profile's own section chrome. */
function Module({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  const t = getT(requestLocale());
  return (
    <div className="bg-surface p-4 sm:p-5">
      <p className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2">
          {icon}
        </span>
        <span className="text-sm font-bold">{t(title)}</span>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{t(body)}</p>
    </div>
  );
}
