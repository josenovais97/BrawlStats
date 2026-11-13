'use client';

import Image from 'next/image';
import { ArrowLeftRight, Flame, Star, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { usePanelI18n } from '@/components/bubble/panel-i18n';
import type { DraftBrawler } from '@/components/bubble/panel-draft';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';
import { sitePrefix } from '@/components/bubble/panel-counters';

/**
 * The post-game review (Bubble 1.40, 2026-11-09).
 *
 * After a Ranked game ends the bubble pulses; tapping it opens the panel on
 * this screen. Everything comes from `/api/bubble/review`, handed over by the
 * app (`window.__bzShowReview`), plus today's record and the daily goal the
 * app keeps itself. It explains the draft and nothing else, because the
 * battle log says nothing about how the game was played (lib/draft-autopsy).
 */

export interface PostGameReview {
  battleTime: string;
  mapName: string | null;
  mode: string | null;
  result: 'victory' | 'defeat';
  eloChange: number | null;
  rank: string | null;
  rankIcon: string | null;
  mine: { id: number; you: boolean; star: boolean }[];
  theirs: { id: number; star: boolean }[];
  winChance: number | null;
  verdict: 'draftWon' | 'upset' | 'even' | 'draftLost' | 'playLost' | 'unknown';
  worst: { brawlerId: number; againstId: number; edge: number; battles: number } | null;
  keyEnemy: { brawlerId: number; edge: number } | null;
  better: { outId: number; inId: number; gain: number } | null;
  /** Added by the app. */
  newGames?: number;
  today?: { wins: number; losses: number } | null;
  goal?: { wins: number; target: number; streak: number } | null;
}

/** "20261109T151120.000Z" as the reader's own clock time. */
function clock(battleTime: string, lang: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(battleTime);
  if (!m) return '';
  const at = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return at.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
}

export function PanelReview({
  review,
  roster,
  modeArt,
  onClose,
  onCounters,
}: {
  review: PostGameReview;
  roster: DraftBrawler[];
  modeArt: Record<string, { label: string; icon: string | null }>;
  onClose: () => void;
  /** Opens the Counters tab on this brawler. */
  onCounters: (brawlerId: number) => void;
}) {
  const { t, tx, lang, name } = usePanelI18n();
  const { tag } = useBubbleAccount();
  const won = review.result === 'victory';
  const byId = new Map(roster.map((b) => [b.brawlerId, b]));
  const brawlerName = (id: number) => {
    const b = byId.get(id);
    return b ? name(b.brawlerName) : '?';
  };
  const rank = (() => {
    if (!review.rank) return null;
    const parts = review.rank.split(' ');
    const numeral = parts.length > 1 && /^[IV]+$/.test(parts[parts.length - 1]) ? parts.pop() : null;
    const word = name(parts.join(' '));
    return numeral ? `${word} ${numeral}` : word;
  })();
  const mode = review.mode ? modeArt[review.mode.toLowerCase()] : undefined;
  const pct = review.winChance !== null ? Math.round(review.winChance * 100) : null;
  const elo = review.eloChange;
  const counterTarget = review.worst?.againstId ?? review.keyEnemy?.brawlerId ?? null;

  const verdict: Record<PostGameReview['verdict'], string> = {
    draftWon: t('review.v.draftWon'),
    upset: t('review.v.upset'),
    even: t('review.v.even'),
    draftLost: t('review.v.draftLost'),
    playLost: t('review.v.playLost'),
    unknown: t('review.v.unknown'),
  };

  const portrait = (id: number, opts: { ring?: 'you' | 'victory' | 'defeat'; star?: boolean; dim?: boolean; size?: number } = {}) => {
    const b = byId.get(id);
    const size = opts.size ?? 40;
    const ring =
      opts.ring === 'you'
        ? 'border-brand shadow-[0_0_0_2px_rgba(255,197,61,0.35)]'
        : opts.ring === 'victory'
          ? 'border-victory'
          : opts.ring === 'defeat'
            ? 'border-defeat'
            : 'border-black/70';
    return (
      <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        {b ? (
          <Image
            src={b.imageUrl}
            alt={name(b.brawlerName)}
            title={name(b.brawlerName)}
            width={size}
            height={size}
            className={`rounded-lg border-2 bg-surface-2 object-cover ${ring} ${opts.dim ? 'opacity-60 grayscale-[40%]' : ''}`}
            style={{ width: size, height: size }}
            unoptimized
          />
        ) : (
          <span className={`block rounded-lg border-2 bg-surface-2 ${ring}`} style={{ width: size, height: size }} />
        )}
        {opts.star ? (
          <span className="absolute -end-1 -top-1 grid size-4 place-items-center rounded-full border border-black/70 bg-brand text-brand-ink">
            <Star className="size-2.5 fill-current" aria-label={t('review.star')} />
          </span>
        ) : null}
      </span>
    );
  };

  const card = (delay: number, children: ReactNode, extra = '') => (
    <div className={`bz-panel bz-review-in px-2.5 py-2 ${extra}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
  const eyebrow = (text: string) => <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{text}</p>;

  return (
    <div className="mx-1 space-y-2 pb-1">
      {/* The result, like the game's own end screen. */}
      <div
        className="bz-review-in relative overflow-hidden rounded-[14px] border-2 border-[#050a1f] px-3 py-2.5 shadow-[0_3px_0_#050a1f]"
        style={{
          background: won
            ? 'linear-gradient(135deg, #2fbf74 0%, #17734a 55%, #0e3f2c 100%)'
            : 'linear-gradient(135deg, #ff5c72 0%, #a3243c 55%, #4a0f1c 100%)',
        }}
      >
        <span
          className="pointer-events-none absolute -end-6 -top-10 size-28 rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }}
          aria-hidden
        />
        <button
          type="button"
          onClick={onClose}
          aria-label={t('review.close')}
          className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/25 text-white/90"
        >
          <X className="size-3.5" />
        </button>
        <div className="flex items-center gap-2.5 pe-6">
          {review.rankIcon ? (
            <Image src={review.rankIcon} alt={rank ?? ''} title={rank ?? ''} width={46} height={46} className="size-[46px] shrink-0 object-contain drop-shadow" unoptimized />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="display text-[26px] uppercase leading-none text-white [text-shadow:0_2px_0_rgba(0,0,0,0.35)]">
              {won ? t('review.victory') : t('review.defeat')}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-white/85">
              {mode?.icon ? <Image src={mode.icon} alt="" width={14} height={14} className="size-3.5 shrink-0 object-contain" unoptimized /> : null}
              <span className="truncate">{review.mapName ? name(review.mapName) : mode ? name(mode.label) : ''}</span>
              <span className="shrink-0 tabular-nums">· {clock(review.battleTime, lang)}</span>
            </p>
          </div>
          {elo !== null ? (
            <div className="shrink-0 text-end leading-none">
              <span className="display text-[24px] tabular-nums text-white [text-shadow:0_2px_0_rgba(0,0,0,0.35)]">
                {elo > 0 ? `+${elo}` : `−${Math.abs(elo)}`}
              </span>
              <span className="block text-[10px] font-bold uppercase text-white/80">elo</span>
            </div>
          ) : null}
        </div>
        {rank ? <p className="mt-1.5 text-[10px] font-bold text-white/80">{rank}</p> : null}
      </div>

      {/* Both teams, the draft's chance and what it means. */}
      {card(
        70,
        <>
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex gap-1">
              {review.mine.map((p) => (
                <span key={`m${p.id}`}>{portrait(p.id, { ring: p.you ? 'you' : undefined, star: p.star })}</span>
              ))}
            </div>
            <span className="display text-xs text-muted">VS</span>
            <div className="flex gap-1">
              {review.theirs.map((p) => (
                <span key={`t${p.id}`}>{portrait(p.id, { star: p.star })}</span>
              ))}
            </div>
          </div>
          {pct !== null ? (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-brand">{t('review.yourDraft', { pct: `${pct}%` })}</span>
                <span className="text-muted">{t('review.theirDraft', { pct: `${100 - pct}%` })}</span>
              </div>
              <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-[#ff5c72]/55">
                <span className="bz-bar-fill block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ) : null}
          <p className="mt-1.5 text-[12px] font-semibold leading-snug">{verdict[review.verdict]}</p>
        </>,
      )}

      {/* What beat the team: the worst matchup, else their strongest pick on the map. */}
      {review.worst
        ? card(
            140,
            <>
              {eyebrow(t('review.counteredBy'))}
              <div className="mt-1.5 flex items-center gap-2">
                {portrait(review.worst.againstId, { ring: 'defeat' })}
                <span className="display text-base text-defeat" aria-hidden>
                  ›
                </span>
                {portrait(review.worst.brawlerId, { dim: true, size: 34 })}
                <div className="min-w-0 flex-1 text-[11px] leading-tight">
                  <p className="font-bold">
                    {tx('review.beats', {
                      a: <b className="text-defeat">{brawlerName(review.worst.againstId)}</b>,
                      b: <b>{brawlerName(review.worst.brawlerId)}</b>,
                    })}
                  </p>
                  <p className="mt-0.5 text-muted">{t('review.edge', { n: Math.abs(review.worst.edge).toFixed(1) })}</p>
                </div>
              </div>
            </>,
          )
        : review.keyEnemy && review.keyEnemy.edge > 0
          ? card(
              140,
              <>
                {eyebrow(t('review.keyEnemy'))}
                <div className="mt-1.5 flex items-center gap-2">
                  {portrait(review.keyEnemy.brawlerId, { ring: 'defeat' })}
                  <div className="min-w-0 flex-1 text-[11px] leading-tight">
                    <p className="font-bold">{brawlerName(review.keyEnemy.brawlerId)}</p>
                    <p className="mt-0.5 text-muted">{t('review.onMap', { n: `+${review.keyEnemy.edge.toFixed(1)}` })}</p>
                  </div>
                </div>
              </>,
            )
          : null}

      {/* A swap the player could have made: their own pick, for one of their power-11 brawlers. */}
      {review.better
        ? card(
            210,
            <>
              {eyebrow(t('review.betterPick'))}
              <div className="mt-1.5 flex items-center gap-2">
                {portrait(review.better.inId, { ring: 'victory' })}
                <ArrowLeftRight className="size-3.5 shrink-0 text-muted" aria-hidden />
                {portrait(review.better.outId, { dim: true, size: 34 })}
                <div className="min-w-0 flex-1 text-[11px] leading-tight">
                  <p className="font-bold">
                    {tx('review.instead', {
                      in: <b className="text-victory">{brawlerName(review.better.inId)}</b>,
                      out: <b>{brawlerName(review.better.outId)}</b>,
                    })}
                  </p>
                  <p className="mt-0.5 font-bold text-victory">{t('review.gain', { n: review.better.gain.toFixed(1) })}</p>
                </div>
              </div>
            </>,
          )
        : null}

      {/* Today, from the app: the record, the daily goal and its streak. */}
      {review.today || review.goal ? (
        <div className="bz-review-in flex items-center gap-2 rounded-xl bg-black/25 px-2.5 py-1.5 text-[11px]" style={{ animationDelay: '280ms' }}>
          {review.today ? (
            <span className="font-bold">
              {t('review.today')}{' '}
              <span className="tabular-nums text-victory">{review.today.wins}</span>
              <span className="text-muted">–</span>
              <span className="tabular-nums text-defeat">{review.today.losses}</span>
            </span>
          ) : null}
          {review.goal && review.goal.target > 0 ? (
            <span className="flex items-center gap-1">
              <span className="text-muted">{t('review.goal')}</span>
              <span className="flex gap-0.5" aria-label={`${Math.min(review.goal.wins, review.goal.target)}/${review.goal.target}`}>
                {Array.from({ length: review.goal.target }, (_, i) => (
                  <span key={i} className={`size-2 rounded-full ${i < review.goal!.wins ? 'bg-brand' : 'bg-white/20'}`} />
                ))}
              </span>
            </span>
          ) : null}
          {review.goal && review.goal.streak > 0 ? (
            <span className="ms-auto flex items-center gap-0.5 font-bold tabular-nums text-[#ff9b3d]">
              <Flame className="size-3.5 fill-current" aria-hidden />
              {review.goal.streak}
            </span>
          ) : null}
        </div>
      ) : null}

      {review.newGames && review.newGames > 1 ? (
        <p className="px-1 text-[10px] text-muted">{t('review.more', { n: review.newGames - 1 })}</p>
      ) : null}

      {/* The whole season on brawlzone.net (1.41 and the panel): the profile's
          Ranked tab, in the browser (inside the app, through its bridge). */}
      {tag ? (
        <button
          type="button"
          onClick={() => {
            const url = `${window.location.origin}${sitePrefix(lang)}/player/${encodeURIComponent(tag)}#ranked`;
            const bridge = (window as unknown as { BrawlZoneApp?: { openExternal?: (u: string) => void } }).BrawlZoneApp;
            if (typeof bridge?.openExternal === 'function') bridge.openExternal(url);
            else window.open(url, '_blank', 'noopener');
          }}
          className="px-1 text-start text-[11px] font-bold text-[#a3eaff] underline-offset-2 hover:underline"
        >
          {t('review.fullSeason')}
        </button>
      ) : null}

      <div className="bz-review-in flex gap-1.5" style={{ animationDelay: '320ms' }}>
        {counterTarget !== null ? (
          <button type="button" onClick={() => onCounters(counterTarget)} className="bz-chip-on min-w-0 flex-1 truncate px-2 py-2 text-[12px]">
            {t('review.counters', { name: brawlerName(counterTarget) })}
          </button>
        ) : null}
        <button type="button" onClick={onClose} className="bz-chip min-w-0 flex-1 truncate px-2 py-2 text-[12px]">
          {t('review.close')}
        </button>
      </div>
    </div>
  );
}
