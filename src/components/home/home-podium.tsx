import Link from 'next/link';
import type { CSSProperties } from 'react';

import { PodiumScroll } from '@/components/home/podium-scroll';
import { brawlerModelUrl, hasBrawlerModel } from '@/lib/brawlapi';
import { titleCase } from '@/lib/format';
import type { TopMetaBrawler } from '@/lib/home-meta';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { wikiThumb } from '@/lib/skin-art';
import { brawlerPath } from '@/lib/slugs';
import { getT } from '@/lib/t';
import { TIER_COLOR } from '@/lib/tiers';
import { getWikiModel } from '@/lib/wiki-art';

/** Each place's step: gold, silver, bronze, as the game colours a podium. */
const STEP: Record<number, string> = {
  1: 'linear-gradient(180deg, #ffe07a 0%, #ffbf2e 45%, #e08a0c 100%)',
  2: 'linear-gradient(180deg, #eef3ff 0%, #c3cde6 45%, #8794b5 100%)',
  3: 'linear-gradient(180deg, #ffc28f 0%, #e8894a 45%, #a5521f 100%)',
};

/**
 * The top three in Ranked as a scene (2026-10-30), the one staged moment on
 * the page: a dark arena where the spotlight finds third place, then second,
 * then first. The owner pointed at oryzo.ai's 3D scroll story; this keeps
 * the idea of a scene that plays as you arrive without the 15 MB of WebGL,
 * using the brawlers' own renders and our real ranking. How it plays is in
 * podium-scroll.tsx; without it, this is a plain podium.
 *
 * Full-body art when all three have it, from the mirror or the wiki, else
 * three portraits: one cut-out beside two framed tiles reads as a failure
 * (the same rule as the hero's stage, and the same URLs, so the browser
 * fetches each picture once).
 */
export async function HomePodium({ top }: { top: TopMetaBrawler[] }) {
  const locale = requestLocale();
  const t = getT(locale);
  const lp = (path: string) => localePath(locale, path);

  const bodies = await Promise.all(
    top.map(async (b) => {
      if (await hasBrawlerModel(b.brawlerId).catch(() => false)) return brawlerModelUrl(b.brawlerId);
      const wiki = await getWikiModel(b.name).catch(() => null);
      return wiki ? wikiThumb(wiki, 460) : null;
    }),
  );
  const full = bodies.every(Boolean);

  return (
    <PodiumScroll className="podium relative left-1/2 w-screen -translate-x-1/2">
      <div className="podium-stage">
        <h2 id="meta-now" className="display text-game-stroke relative px-4 text-center text-3xl sm:text-5xl">
          {t('Best in Ranked right now')}
        </h2>

        <div className="podium-row">
          <span aria-hidden className="podium-beam" />
          <ol className="podium-places">
            {top.map((b, i) => {
              const rank = i + 1;
              const name = titleCase(b.name);
              return (
                <li
                  key={b.brawlerId}
                  data-podium-slot
                  data-rank={rank}
                  className="podium-slot"
                  style={{ '--tier': TIER_COLOR[b.tier], '--step': STEP[rank] } as CSSProperties}
                >
                  <Link href={lp(brawlerPath(b.brawlerId, b.name))} prefetch={false} className="podium-link">
                    <span className="podium-figure">
                      {rank === 1 ? <span aria-hidden className="podium-rays" /> : null}
                      {/* eslint-disable-next-line @next/next/no-img-element -- CDN art, served as is (images.unoptimized) */}
                      <img
                        src={full ? bodies[i]! : b.portraitUrl}
                        alt=""
                        width={460}
                        height={670}
                        loading="lazy"
                        decoding="async"
                        className={full ? 'podium-art' : 'podium-art podium-disc'}
                      />
                      <span className="tier-badge tier-badge-sm podium-badge" style={{ '--tier': TIER_COLOR[b.tier] } as CSSProperties}>
                        <span aria-hidden className="display text-game-stroke text-xl leading-none">{b.tier}</span>
                        <span className="sr-only">{t('{tier} tier', { tier: b.tier })}</span>
                      </span>
                    </span>
                    <span className="podium-step">
                      <span className="podium-info">
                        <span className="display text-game-stroke block truncate text-lg leading-tight sm:text-2xl">{name}</span>
                        <span className="block text-xs font-bold tabular-nums text-white/85 sm:text-sm">
                          {b.score.toFixed(1)}/10
                        </span>
                      </span>
                      <span aria-hidden className="podium-num display text-game-stroke">{rank}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </PodiumScroll>
  );
}
