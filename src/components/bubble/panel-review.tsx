'use client';

import Image from 'next/image';
import { ArrowLeftRight, Ban, ChevronLeft, ChevronRight, Crosshair, Flame, HeartPulse, Star, X, Zap } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { usePanelI18n } from '@/components/bubble/panel-i18n';
import type { DraftBrawler } from '@/components/bubble/panel-draft';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';
import type { PanelMode } from '@/components/bubble/panel-tiers';
import { canField } from '@/lib/bubble-account';
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

/** One player's line of the scoreboard. */
export interface BoardLine {
  k: number;
  d: number;
  dmg: number;
  heal: number;
}

export interface PostGameReview {
  battleTime: string;
  mapName: string | null;
  mode: string | null;
  result: 'victory' | 'defeat';
  eloChange: number | null;
  rank: string | null;
  rankIcon: string | null;
  mine: { id: number; you: boolean; star: boolean; s?: BoardLine | null }[];
  theirs: { id: number; star: boolean; s?: BoardLine | null }[];
  /** Who each side banned (2026-11-25). */
  bans?: { mine: number[]; theirs: number[] };
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

/** "20261109T151120.000Z" as a Date, or null. */
function battleDate(battleTime: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(battleTime);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

/** "20261109T151120.000Z" as the reader's own clock time. */
function clock(battleTime: string, lang: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(battleTime);
  if (!m) return '';
  const at = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return at.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
}

export function PanelReview({
  review: initial,
  roster,
  modeArt,
  onClose,
  onCounters,
  modes = [],
  onDraft,
}: {
  review: PostGameReview;
  roster: DraftBrawler[];
  modeArt: Record<string, { label: string; icon: string | null }>;
  onClose: () => void;
  /** Opens the Counters tab on this brawler. */
  onCounters: (brawlerId: number) => void;
  /** The panel's Ranked lists, for "next time on this map" (1.43). */
  modes?: PanelMode[];
  /** Opens the Draft tab on this map (1.43). */
  onDraft?: (mode: string, mapName: string) => void;
}) {
  const { t, tx, lang, name } = usePanelI18n();
  const account = useBubbleAccount();
  const { tag } = account;

  /*
   * Today's games (1.43): a strip of results above the card, and a swipe
   * through them. The game the bubble pulsed for opens first; any other is
   * read on demand from the match history's own route.
   */
  const [review, setReview] = useState<PostGameReview>(initial);
  const [today, setToday] = useState<{ battleTime: string; result: 'victory' | 'defeat' }[]>([]);
  const [loadingGame, setLoadingGame] = useState<string | null>(null);
  useEffect(() => {
    if (!tag) return;
    const controller = new AbortController();
    fetch(`/api/bubble/history?tag=${encodeURIComponent(tag)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { games?: { battleTime: string; result: 'victory' | 'defeat' }[] }) => {
        const day = (bt: string) => battleDate(bt)?.toDateString() ?? '';
        const anchor = day(initial.battleTime) || new Date().toDateString();
        setToday((data.games ?? []).filter((g) => day(g.battleTime) === anchor).reverse());
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [tag, initial.battleTime]);
  const openGame = (battleTime: string) => {
    if (!tag || battleTime === review.battleTime || loadingGame) return;
    if (battleTime === initial.battleTime) {
      setReview(initial);
      return;
    }
    setLoadingGame(battleTime);
    fetch(`/api/bubble/review?tag=${encodeURIComponent(tag)}&lang=${encodeURIComponent(lang)}&game=${encodeURIComponent(battleTime)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { game?: PostGameReview | null }) => {
        if (data.game && Array.isArray(data.game.mine)) setReview(data.game);
      })
      .catch(() => undefined)
      .finally(() => setLoadingGame(null));
  };
  const at = today.findIndex((g) => g.battleTime === review.battleTime);
  const step = (dir: -1 | 1) => {
    const next = today[at + dir];
    if (at >= 0 && next) openGame(next.battleTime);
  };
  const touch = useRef<number | null>(null);
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

  /* Next time on this map (1.43): its best Ranked picks you can field. */
  const mapLists = modes.flatMap((m) => m.maps);
  const thisMap = review.mapName ? mapLists.find((m) => m.mapName === review.mapName) ?? null : null;
  const fieldable = (id: number) => account.owned === null || canField(account.owned, id, account.filter);
  const nextPicks = thisMap ? thisMap.picks.filter((p) => fieldable(p.brawlerId)).slice(0, 3) : [];
  const yourId = review.mine.find((p) => p.you)?.id ?? null;
  const yourRank = thisMap && yourId !== null ? thisMap.picks.findIndex((p) => p.brawlerId === yourId) : -1;

  return (
    <div
      className="mx-1 space-y-2 pb-1"
      onTouchStart={(e) => {
        touch.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const from = touch.current;
        touch.current = null;
        const to = e.changedTouches[0]?.clientX;
        if (from === null || to === undefined) return;
        // Right to left = the newer game, like turning a page.
        if (from - to > 60) step(1);
        else if (to - from > 60) step(-1);
      }}
    >
      {today.length > 1 ? (
        <div className="flex items-center gap-1 overflow-hidden">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted">{t('review.today')}</span>
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={at <= 0}
            aria-label="‹"
            className="grid size-6 shrink-0 place-items-center rounded text-muted disabled:opacity-30"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {today.map((g) => {
              const on = g.battleTime === review.battleTime;
              return (
                <button
                  key={g.battleTime}
                  type="button"
                  onClick={() => openGame(g.battleTime)}
                  aria-pressed={on}
                  title={clock(g.battleTime, lang)}
                  className={`grid size-6 shrink-0 place-items-center rounded-md border-2 text-[11px] font-black ${
                    g.result === 'victory' ? 'bg-victory/25 text-victory' : 'bg-defeat/25 text-defeat'
                  } ${on ? 'border-brand' : 'border-transparent'} ${loadingGame === g.battleTime ? 'animate-pulse' : ''}`}
                >
                  {g.result === 'victory' ? '✓' : '✗'}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={at < 0 || at >= today.length - 1}
            aria-label="›"
            className="grid size-6 shrink-0 place-items-center rounded text-muted disabled:opacity-30"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

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

      <Scoreboard review={review} brawlerName={brawlerName} portrait={portrait} />

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

      {/* Next time on this map (1.43): what to take here, and a way to draft it. */}
      {thisMap && (nextPicks.length > 0 || yourRank >= 0)
        ? card(
            250,
            <>
              {eyebrow(t('review.nextTime', { map: name(thisMap.mapName) }))}
              {nextPicks.length > 0 ? (
                <div className="mt-1.5 flex items-center gap-2">
                  {nextPicks.map((p) => (
                    <span key={p.brawlerId} className="flex min-w-0 flex-col items-center gap-0.5">
                      {portrait(p.brawlerId, { ring: 'victory', size: 34 })}
                      <span className="text-[9px] font-bold tabular-nums text-victory">{t('draft.map', { n: (p.score * 100).toFixed(0) })}</span>
                    </span>
                  ))}
                  {onDraft ? (
                    <button
                      type="button"
                      onClick={() => onDraft(thisMap.mode, thisMap.mapName)}
                      className="bz-chip ms-auto shrink-0 px-2 py-1.5 text-[11px]"
                    >
                      {t('tab.draft')} →
                    </button>
                  ) : null}
                </div>
              ) : null}
              {yourRank >= 0 && yourId !== null ? (
                <p className="mt-1.5 text-[11px] text-muted">
                  {t('review.yourPickHere', {
                    name: brawlerName(yourId),
                    n: (thisMap.picks[yourRank].score * 100).toFixed(0),
                    rank: yourRank + 1,
                    count: thisMap.picks.length,
                  })}
                </p>
              ) : null}
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

/**
 * The game's scoreboard (2026-11-25): all six players' kills, deaths, damage
 * and healing, best kills and damage in gold, and who each side banned.
 * Nothing for a game from before the battle log carried it.
 */
function Scoreboard({
  review,
  brawlerName,
  portrait,
}: {
  review: PostGameReview;
  brawlerName: (id: number) => string;
  portrait: (id: number, opts?: { ring?: 'you' | 'victory' | 'defeat'; star?: boolean; dim?: boolean; size?: number }) => ReactNode;
}) {
  const { t, lang } = usePanelI18n();
  const lines = [...review.mine, ...review.theirs].map((p) => p.s).filter((x): x is BoardLine => Boolean(x));
  if (lines.length < 2) return null;
  const topKills = Math.max(...lines.map((x) => x.k));
  const topDamage = Math.max(1, ...lines.map((x) => x.dmg));
  const heals = lines.some((x) => x.heal > 0);
  const short = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString(lang, { maximumFractionDigits: n >= 100_000 ? 0 : 1 })}k` : String(n));
  const cols = heals ? 'grid-cols-[minmax(0,1fr)_2.6rem_3rem_3rem]' : 'grid-cols-[minmax(0,1fr)_2.6rem_3rem]';

  const row = (p: { id: number; you?: boolean; star: boolean; s?: BoardLine | null }, key: string, side: 'mine' | 'theirs') => {
    const x = p.s;
    return (
      <div key={key} className={`grid ${cols} items-center gap-1 rounded-md px-1 py-0.5 ${p.you ? 'bg-brand/15 ring-1 ring-inset ring-brand/40' : ''}`}>
        <span className="flex min-w-0 items-center gap-1.5">
          {portrait(p.id, { ring: p.you ? 'you' : undefined, star: p.star, size: 24 })}
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[11px] font-bold leading-tight ${p.you ? 'text-brand' : ''}`}>{brawlerName(p.id)}</span>
            {/* The damage as a bar, against the game's highest. */}
            <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-black/30">
              <span
                className={`block h-full rounded-full ${side === 'mine' ? 'bg-[#35d0ff]' : 'bg-defeat'}`}
                style={{ width: x ? `${Math.round((x.dmg / topDamage) * 100)}%` : 0 }}
              />
            </span>
          </span>
        </span>
        <span className="text-center text-[12px] font-black tabular-nums">
          {x ? (
            <>
              <span className={x.k === topKills && x.k > 0 ? 'text-brand' : ''}>{x.k}</span>
              <span className="font-bold text-muted">/{x.d}</span>
            </>
          ) : (
            '–'
          )}
        </span>
        <span className={`text-end text-[11px] font-bold tabular-nums ${x && x.dmg === topDamage ? 'text-brand' : ''}`}>{x ? short(x.dmg) : '–'}</span>
        {heals ? <span className="text-end text-[11px] tabular-nums text-muted">{x && x.heal > 0 ? short(x.heal) : '–'}</span> : null}
      </div>
    );
  };
  const bans = (ids: number[] | undefined) =>
    ids && ids.length > 0 ? (
      <span className="flex items-center gap-1" title={t('review.bans')}>
        <Ban className="size-3 text-muted" aria-label={t('review.bans')} />
        {ids.map((id) => (
          <span key={id}>{portrait(id, { dim: true, size: 18 })}</span>
        ))}
      </span>
    ) : null;

  return (
    <div className="bz-panel bz-review-in px-2 py-2" style={{ animationDelay: '50ms' }}>
      <div className={`grid ${cols} items-center gap-1 px-1 text-[10px] font-bold uppercase tracking-wider text-muted`}>
        <span>{t('review.scoreboard')}</span>
        <span className="flex items-center justify-center gap-0.5" title={`${t('stat.kills')} / ${t('stat.deaths')}`}>
          <Crosshair className="size-3" aria-label={`${t('stat.kills')} / ${t('stat.deaths')}`} />
          <span className="normal-case tracking-normal">{t('stat.kd')}</span>
        </span>
        <span className="flex justify-end" title={t('stat.damage')}>
          <Zap className="size-3" aria-label={t('stat.damage')} />
        </span>
        {heals ? (
          <span className="flex justify-end" title={t('stat.healing')}>
            <HeartPulse className="size-3" aria-label={t('stat.healing')} />
          </span>
        ) : null}
      </div>
      <div className="mt-1 space-y-0.5">{review.mine.map((p) => row(p, `m${p.id}`, 'mine'))}</div>
      <div className="my-1 flex items-center gap-2 px-1">
        {bans(review.bans?.mine)}
        <span className="h-px flex-1 bg-border" />
        <span className="display text-[10px] text-muted">VS</span>
        <span className="h-px flex-1 bg-border" />
        {bans(review.bans?.theirs)}
      </div>
      <div className="space-y-0.5">{review.theirs.map((p) => row(p, `t${p.id}`, 'theirs'))}</div>
    </div>
  );
}
