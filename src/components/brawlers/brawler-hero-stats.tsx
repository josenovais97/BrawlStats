import Image from 'next/image';
import Link from 'next/link';

import { isListedMode } from '@/lib/battle-mode';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatPercent } from '@/lib/format';
import type { GameMap } from '@/lib/game-maps';
import { localePath } from '@/lib/i18n';
import { gameWords } from '@/lib/i18n-game';
import { brawlerPath, slugify } from '@/lib/slugs';
import type { BrawlerPairing, BrawlerPairings, BrawlerSplit } from '@/lib/stats';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';
import type { MetaMover } from '@/types/stats';

/**
 * The page's numbers in the hero (2026-11-11), the way the profile's Ranked
 * tab leads: four big tiles -- win rate, pick rate, place in this week's
 * Ranked list, the week's move -- then the brawler at a glance: best mode,
 * best map, who it beats, who beats it, who to pair it with.
 */
export async function BrawlerHeroStats({
  winRate,
  pickRate,
  pickPlace,
  metaPlace,
  metaTotal,
  mover,
  splits,
  pairings,
  brawlerMeta,
  modeMeta,
  activeMaps,
}: {
  winRate: number | null;
  pickRate: number | null;
  pickPlace: number;
  metaPlace: number;
  metaTotal: number;
  mover: MetaMover | null;
  splits: { modes: BrawlerSplit[]; maps: BrawlerSplit[] };
  pairings: BrawlerPairings | null;
  brawlerMeta: Map<number, BABrawler>;
  modeMeta: Map<string, BAGameMode>;
  activeMaps: GameMap[];
}) {
  const locale = requestLocale();
  const t = getT(locale);
  const words = await gameWords(locale);
  const lp = (path: string) => localePath(locale, path);

  const tiles: { label: string; value: string; sub: string; tone: string }[] = [];
  if (winRate !== null) {
    tiles.push({
      label: t('Win rate'),
      value: formatPercent(winRate),
      sub: t('{diff} vs average', { diff: `${winRate >= 0.5 ? '+' : '−'}${Math.abs((winRate - 0.5) * 100).toFixed(1)}` }),
      tone: winRate >= 0.5 ? 'text-victory' : 'text-defeat',
    });
  }
  if (pickRate !== null) {
    tiles.push({
      label: t('Pick rate'),
      value: formatPercent(pickRate),
      sub: pickPlace > 0 ? t('#{n} most picked this week', { n: pickPlace }) : t('Last 7 days'),
      tone: 'text-accent',
    });
  }
  if (metaPlace > 0) {
    tiles.push({ label: t('In Ranked'), value: `#${metaPlace}`, sub: t('of {n} this week', { n: metaTotal }), tone: 'text-brand' });
  }
  if (mover) {
    tiles.push({
      label: t('This week'),
      value: `${mover.metaScoreDelta >= 0 ? '▲ +' : '▼ −'}${Math.abs(mover.metaScoreDelta).toFixed(1)}`,
      sub:
        mover.tierBefore !== mover.tierNow
          ? t('{from} tier to {to} tier', { from: mover.tierBefore, to: mover.tierNow })
          : t('Meta score, still {tier} tier', { tier: mover.tierNow }),
      tone: mover.metaScoreDelta >= 0 ? 'text-victory' : 'text-defeat',
    });
  }

  // Listed modes only, as "Where it performs" does: no 5v5 or event variants.
  const bestMode = splits.modes.find((m) => isListedMode(m.mode)) ?? null;
  const bestMap = splits.maps.find((m) => isListedMode(m.mode)) ?? null;
  const bestMapArt = bestMap ? activeMaps.find((m) => m.scHash === bestMap.mode && m.mapSlug === slugify(bestMap.mapName ?? '')) : undefined;
  const faces = (rows: BrawlerPairing[] | undefined) => (rows ?? []).slice(0, 3);
  const glance = [
    pairings && pairings.strongAgainst.length > 0 ? { label: t('Beats'), rows: faces(pairings.strongAgainst), tone: 'text-victory' } : null,
    pairings && pairings.weakAgainst.length > 0 ? { label: t('Countered by'), rows: faces(pairings.weakAgainst), tone: 'text-defeat' } : null,
    pairings && pairings.bestWith.length > 0 ? { label: t('Best with'), rows: faces(pairings.bestWith), tone: 'text-accent' } : null,
  ].filter((g): g is NonNullable<typeof g> => g !== null);

  if (tiles.length === 0 && !bestMode && glance.length === 0) return null;

  return (
    <div className="relative space-y-3 border-t border-border/70 p-4 sm:px-6">
      {tiles.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-2xl border-2 border-ink bg-surface-2/70 px-4 py-3">
              <p className="label-game text-xs text-muted">{tile.label}</p>
              <p className={`display mt-1 text-3xl leading-none sm:text-4xl ${tile.tone}`}>{tile.value}</p>
              <p className="mt-1.5 truncate text-xs text-muted">{tile.sub}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        {bestMode ? (
          <div className="flex items-center gap-2.5 rounded-xl bg-surface-2/50 px-3 py-2.5">
            {modeMeta.get(bestMode.mode.toLowerCase())?.imageUrl ? (
              <Image src={modeMeta.get(bestMode.mode.toLowerCase())!.imageUrl} alt="" width={30} height={30} unoptimized className="size-[30px] shrink-0 object-contain" />
            ) : null}
            <span className="min-w-0">
              <span className="block text-[11px] text-muted">{t('Best mode')}</span>
              <span className="block truncate text-sm font-bold">{words.mode(bestMode.mode)}</span>
              <span className="block text-xs font-bold tabular-nums text-victory">{formatPercent(bestMode.score)}</span>
            </span>
          </div>
        ) : null}
        {bestMap ? (
          <div className="flex items-center gap-2.5 rounded-xl bg-surface-2/50 px-3 py-2.5">
            {bestMapArt?.map.imageUrl ? (
              <Image src={bestMapArt.map.imageUrl} alt="" width={34} height={34} unoptimized className="size-[34px] shrink-0 rounded-md border-2 border-ink object-cover" />
            ) : null}
            <span className="min-w-0">
              <span className="block text-[11px] text-muted">{t('Best map')}</span>
              <span className="block truncate text-sm font-bold">{t(bestMap.mapName ?? '–')}</span>
              <span className="block text-xs font-bold tabular-nums text-victory">{formatPercent(bestMap.score)}</span>
            </span>
          </div>
        ) : null}
        {glance.map((g) => (
          <div key={g.label} className="rounded-xl bg-surface-2/50 px-3 py-2.5">
            <span className={`block text-[11px] font-bold ${g.tone}`}>{g.label}</span>
            <span className="mt-1.5 flex gap-1.5">
              {g.rows.map((r) => {
                const meta = brawlerMeta.get(r.brawlerId);
                const name = meta?.name ?? '';
                return (
                  <Link key={r.brawlerId} href={lp(brawlerPath(r.brawlerId, name))} prefetch={false} title={name} className="shrink-0 transition-transform hover:scale-105">
                    <Image
                      src={meta?.imageUrl ?? brawlerIconUrl(r.brawlerId)}
                      alt={name}
                      width={36}
                      height={36}
                      unoptimized
                      className="size-9 rounded-lg border-2 border-ink bg-surface-3"
                    />
                  </Link>
                );
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
