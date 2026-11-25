'use client';

import { Ban, Crosshair, HeartPulse, Shield, Skull, Star, Swords, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';

import { useLp } from '@/components/i18n/use-lp';
import { useT } from '@/components/i18n/use-t';
import { brawlerIconUrl } from '@/lib/brawlapi';
import {
  METRICS, MIN_GAMES, NUMBER_MODES, banTiers, bestFirst, rankBy,
  type BanList, type BrawlerNumbers, type Metric, type RankKey, type RankNumbers,
} from '@/lib/ranked-numbers';
import { brawlerPath } from '@/lib/slugs';
import { TIER_COLOR } from '@/lib/tiers';

/**
 * Ranked bans, kills, deaths and damage (2026-11-25, owner: "a page with all
 * this info"). One address: the rank, the map and the number are chosen here
 * and never in a URL, so there is nothing to crawl but the page itself
 * (AGENTS.md trap 5).
 */

export interface NumbersLabels {
  ranks: { key: RankKey; label: string; icon: string | null }[];
  modes: Record<string, { label: string; icon: string | null }>;
  /** A map's name in the reader's game, by the name in the data. */
  maps: Record<string, string>;
  brawlers: Record<number, string>;
}

const ICONS: Record<Metric, typeof Ban> = { kd: Swords, kills: Crosshair, deaths: Skull, damage: Zap, healing: HeartPulse, star: Star, deathless: Shield };
const COLORS: Record<Metric, string> = { kd: '#ff9f45', kills: '#ff5c72', deaths: '#9aa3c0', damage: '#ffc53d', healing: '#7ad97a', star: '#ffd23f', deathless: '#7fb3ff' };
const SHOWN = 12;

const chip = 'inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-sm';
const cls = (on: boolean) => `${chip} ${on ? 'bz-chip-on' : 'bz-chip hover:text-white'}`;

function Chips({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="group" aria-label={label} className="flex w-max gap-2">{children}</div>
    </div>
  );
}

function Icon({ src }: { src: string | null | undefined }) {
  return src ? <Image src={src} alt="" width={22} height={22} className="size-[22px] shrink-0 object-contain" unoptimized /> : null;
}

export function RankedNumbers({ first, labels }: { first: RankNumbers; labels: NumbersLabels }) {
  const t = useT();
  const lp = useLp();
  const [data, setData] = useState(first);
  const [rank, setRank] = useState<RankKey>(first.rank);
  const [busy, setBusy] = useState(false);
  const seen = useRef(new Map<RankKey, RankNumbers>([[first.rank, first]]));
  const asked = useRef<RankKey>(first.rank);
  const [map, setMap] = useState<string | null>(null);
  const [banMode, setBanMode] = useState<string | null>(null);
  const [mode, setMode] = useState('all');
  const [metric, setMetric] = useState<Metric>('kd');
  const [order, setOrder] = useState<'high' | 'low'>('high');
  const [all, setAll] = useState(false);

  async function choose(next: RankKey) {
    setRank(next);
    asked.current = next;
    let got = seen.current.get(next) ?? null;
    if (!got) {
      setBusy(true);
      got = await fetch(`/api/ranked-numbers/${next}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (got) seen.current.set(next, got);
    }
    // A slow answer must not replace a rank chosen since.
    if (asked.current !== next) return;
    setBusy(false);
    if (got) setData(got);
  }

  const name = (id: number) => labels.brawlers[id] ?? `#${id}`;
  const metricLabel: Record<Metric, string> = {
    kd: t('K/D'), kills: t('Kills'), deaths: t('Deaths'), damage: t('Damage'), healing: t('Healing'), star: t('Star player'), deathless: t('Never died'),
  };
  const value = (m: Metric, r: BrawlerNumbers) =>
    m === 'kd' ? r.kd.toFixed(2)
      : m === 'kills' ? t('{n} a game', { n: r.kills.toFixed(2) })
        : m === 'deaths' ? t('{n} a game', { n: r.deaths.toFixed(2) })
          : m === 'damage' ? t('{n} a second', { n: Math.round(r.damage) })
            : m === 'healing' ? t('{n} a second', { n: Math.round(r.healing) })
              : t('{n}% of games', { n: ((m === 'star' ? r.star : r.deathless) * 100).toFixed(1) });

  const mapBans = map ? data.maps.find((m) => `${m.mode}|${m.map}` === map) ?? null : null;
  // An answer cached before the modes were added has none.
  const modeBans = banMode ? data.modes?.[banMode] ?? null : null;
  const bans: BanList = map ? mapBans?.bans ?? [] : banMode ? modeBans?.bans ?? [] : data.bans;
  const banGames = map ? mapBans?.battles ?? 0 : banMode ? modeBans?.battles ?? 0 : data.battles;
  const tiers = banTiers(bans);
  const rows = useMemo(() => rankBy(data.stats[mode] ?? [], metric, order), [data, mode, metric, order]);
  const shown = all ? rows : rows.slice(0, SHOWN);
  const top = Math.max(0.0001, ...rows.map((r) => r[metric]));
  const pick = (m: Metric) => {
    setMetric(m);
    setOrder(bestFirst(m));
    setAll(false);
  };

  /** A highlight goes to its list: the bans, or that number's ranking. */
  const show = (m: Metric | null) => {
    if (m) {
      setMode('all');
      pick(m);
    } else {
      setBanMode(null);
      setMap(null);
    }
    document.getElementById(m ? 'numbers' : 'bans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const every = data.stats.all ?? [];
  const best = (m: Metric) => rankBy(every, m, bestFirst(m))[0];
  const highlights = [
    data.bans[0] ? { key: 'ban', label: t('Most banned'), id: data.bans[0][0], text: t('{n}% of games', { n: Math.round(data.bans[0][1] * 100) }), icon: Ban, color: '#ff5c72', metric: null } : null,
    ...(['kd', 'deaths', 'damage', 'star'] as Metric[]).map((m) => {
      const r = best(m);
      if (!r) return null;
      const label = m === 'kd' ? t('Best K/D') : m === 'deaths' ? t('Dies the least') : m === 'damage' ? t('Most damage') : t('Most star players');
      return { key: m, label, id: r.id, text: value(m, r), icon: ICONS[m], color: COLORS[m], metric: m };
    }),
  ].filter((x) => x !== null);

  const face = (id: number, size: number) => (
    <Image src={brawlerIconUrl(id)} alt="" width={size} height={size} className="rounded-lg bg-surface-2" style={{ width: size, height: size }} loading="lazy" unoptimized />
  );

  return (
    <div className={`space-y-10 transition-opacity ${busy ? 'opacity-50' : ''}`} aria-busy={busy}>
      <Chips label={t('Choose a rank')}>
        {labels.ranks.map((r) => (
          <button key={r.key} type="button" aria-pressed={rank === r.key} onClick={() => choose(r.key)} className={cls(rank === r.key)}>
            <Icon src={r.icon} />
            {r.label}
          </button>
        ))}
      </Chips>

      {data.battles === 0 ? (
        <p className="card p-6 text-sm text-muted">{t('Not enough games here yet.')}</p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {highlights.map((h, i) => (
              <li key={h.key} className={i === 0 ? 'col-span-2 lg:col-span-1' : ''}>
                <button type="button" onClick={() => show(h.metric)} className="reward-tile flex h-full w-full items-center gap-3 p-4 text-left lg:flex-col lg:items-start">
                  {face(h.id, 56)}
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: h.color }}>
                      <h.icon aria-hidden className="size-3.5" />
                      {h.label}
                    </span>
                    <span className="display block truncate text-lg text-white">{name(h.id)}</span>
                    <span className="block text-sm tabular-nums text-white/75">{h.text}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <section className="space-y-4" aria-labelledby="bans">
            <div>
              <h2 id="bans" className="display scroll-mt-20 text-game-stroke text-2xl sm:text-3xl">{t('Ban tier list')}</h2>
              <p className="mt-1 text-sm text-muted">{t('How often each brawler gets banned in a game.')}</p>
            </div>
            <Chips label={t('Map')}>
              <button type="button" aria-pressed={!banMode} onClick={() => { setBanMode(null); setMap(null); }} className={cls(!banMode)}>{t('All maps')}</button>
              {NUMBER_MODES.filter((m) => data.maps.some((x) => x.mode === m)).map((m) => (
                <button key={m} type="button" aria-pressed={banMode === m} onClick={() => { setBanMode(m); setMap(null); }} className={cls(banMode === m)}>
                  <Icon src={labels.modes[m]?.icon} />
                  {labels.modes[m]?.label ?? m}
                </button>
              ))}
            </Chips>
            {banMode ? (
              <Chips label={labels.modes[banMode]?.label ?? banMode}>
                <button type="button" aria-pressed={!map} onClick={() => setMap(null)} className={cls(!map)}>{t('All maps')}</button>
                {data.maps.filter((x) => x.mode === banMode).map((x) => {
                  const key = `${x.mode}|${x.map}`;
                  return (
                    <button key={key} type="button" aria-pressed={map === key} onClick={() => setMap(key)} className={cls(map === key)}>{labels.maps[x.map] ?? x.map}</button>
                  );
                })}
              </Chips>
            ) : null}
            {bans.length === 0 ? (
              <p className="card p-5 text-sm text-muted">{t('Not enough games here yet.')}</p>
            ) : (
              <div className="space-y-2">
                {tiers.map((row) => (
                  <div key={row.tier} className="flex overflow-hidden rounded-2xl bg-surface">
                    <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 px-1 py-3 text-center sm:w-24" style={{ background: TIER_COLOR[row.tier] }}>
                      <span className="display text-3xl leading-none text-[#10142a] sm:text-4xl">{row.tier}</span>
                      <span className="text-[11px] font-bold leading-tight text-[#10142a]">{`${Math.round(row.min * 100)}%+`}</span>
                    </div>
                    <ul className="flex min-h-20 flex-1 flex-wrap content-center gap-2 p-2.5 sm:gap-3 sm:p-3">
                      {row.items.map(([id, r]) => (
                        <li key={id}>
                          <Link href={lp(brawlerPath(id, labels.brawlers[id]))} prefetch={false} title={name(id)} className="flex w-14 flex-col items-center gap-1 sm:w-16">
                            {face(id, 52)}
                            <span className="text-xs font-bold tabular-nums">{Math.round(r * 100)}%</span>
                          </Link>
                        </li>
                      ))}
                      {row.items.length === 0 ? <li className="self-center px-1 text-sm text-muted">{t('Nobody')}</li> : null}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted">
              {t('From {n} games.', { n: banGames.toLocaleString('en-US') })}{' '}
              {t('The letter is the share of games a brawler is banned in: S from 40%, A from 20%, B from 10%, C from 5%.')}
            </p>
          </section>

          <section className="space-y-4" aria-labelledby="numbers">
            <div>
              <h2 id="numbers" className="display scroll-mt-20 text-game-stroke text-2xl sm:text-3xl">{t('Kills, deaths and damage')}</h2>
              <p className="mt-1 text-sm text-muted">{t('What each brawler does in a game, on average.')}</p>
            </div>
            <Chips label={t('Kills, deaths and damage')}>
              {METRICS.map((m) => {
                const I = ICONS[m];
                return (
                  <button key={m} type="button" aria-pressed={metric === m} onClick={() => pick(m)} className={cls(metric === m)}>
                    <I aria-hidden className="size-4" />
                    {metricLabel[m]}
                  </button>
                );
              })}
            </Chips>
            <Chips label={t('All modes')}>
              <button type="button" aria-pressed={mode === 'all'} onClick={() => setMode('all')} className={cls(mode === 'all')}>{t('All modes')}</button>
              {NUMBER_MODES.map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cls(mode === m)}>
                  <Icon src={labels.modes[m]?.icon} />
                  {labels.modes[m]?.label ?? m}
                </button>
              ))}
            </Chips>
            {rows.length === 0 ? (
              <p className="card p-5 text-sm text-muted">{t('Not enough games here yet.')}</p>
            ) : (
              <>
                <div className="flex justify-end gap-2">
                  <button type="button" aria-pressed={order === 'high'} onClick={() => setOrder('high')} className={cls(order === 'high')}>{t('Highest first')}</button>
                  <button type="button" aria-pressed={order === 'low'} onClick={() => setOrder('low')} className={cls(order === 'low')}>{t('Lowest first')}</button>
                </div>
                <ol className="card divide-y divide-border overflow-hidden">
                  {shown.map((r, i) => (
                    <li key={r.id}>
                      <Link href={lp(brawlerPath(r.id, labels.brawlers[r.id]))} prefetch={false} className="row-interactive flex items-center gap-3 px-3 py-2.5 sm:px-4">
                        <span className={`display w-8 shrink-0 text-center text-xl ${i === 0 ? 'text-brand' : 'text-muted'}`}>{i + 1}</span>
                        {face(r.id, 44)}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="truncate font-semibold">{name(r.id)}</span>
                            <span className="shrink-0 font-bold tabular-nums">{value(metric, r)}</span>
                          </span>
                          <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-surface-2">
                            <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (r[metric] / top) * 100)}%`, background: COLORS[metric] }} />
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
                {rows.length > SHOWN ? (
                  <button type="button" onClick={() => setAll(!all)} className="btn-game mx-auto flex bg-surface-2 px-6 py-3 text-foreground [--btn-shadow:#0a0d1c]">
                    {all ? t('Show less') : t('Show all {n}', { n: rows.length })}
                  </button>
                ) : null}
                <p className="text-xs text-muted">{t('Brawlers with fewer than {n} games are left out. Damage and healing are per second of the whole game.', { n: MIN_GAMES })}</p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
