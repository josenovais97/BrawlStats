'use client';

import { ChevronLeft, Flame, Star } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import type { DraftBrawler } from '@/components/bubble/panel-draft';
import { usePanelI18n } from '@/components/bubble/panel-i18n';
import { PanelReview, type PostGameReview } from '@/components/bubble/panel-review';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';
import { haptic } from '@/lib/haptics';
import { panelTrack } from '@/lib/panel-telemetry';

interface Side {
  id: number;
  you?: boolean;
  star: boolean;
}

interface HistoryGame {
  battleTime: string;
  mode: string | null;
  mapName: string | null;
  result: 'victory' | 'defeat';
  duration: number | null;
  mine: Side[];
  theirs: Side[];
}

/** "20261109T151120.000Z" -> Date. */
function when(battleTime: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(battleTime);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
}

/**
 * Match history (2026-11-13): the Ranked games still in the battle log, up
 * to 25, as a list worth scrolling -- record, win rate, best streak and star
 * player count up top, a strip of the run, then each game by day with the
 * map, both teams and the result. Tap one for its full review, the same
 * screen the bubble shows right after a game. Opened from the History chip
 * on the season line, or the bubble's long-press menu.
 */
export function PanelHistory({
  roster,
  modeArt,
  onClose,
  onCounters,
}: {
  roster: DraftBrawler[];
  modeArt: Record<string, { label: string; icon: string | null }>;
  onClose: () => void;
  onCounters: (brawlerId: number) => void;
}) {
  const { t, name, lang } = usePanelI18n();
  const { tag } = useBubbleAccount();
  const [games, setGames] = useState<HistoryGame[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<PostGameReview | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  // The clock once, when the list opens: "Today" does not move under a reader.
  const [now] = useState(() => Date.now());
  const byId = useMemo(() => new Map(roster.map((b) => [b.brawlerId, b])), [roster]);

  useEffect(() => {
    if (!tag) return;
    const controller = new AbortController();
    panelTrack('panel_history');
    fetch(`/api/bubble/history?tag=${encodeURIComponent(tag)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { games: HistoryGame[]; unavailable?: boolean }) => {
        if (d.unavailable) setFailed(true);
        setGames(d.games ?? []);
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setFailed(true);
      });
    return () => controller.abort();
  }, [tag]);

  const openGame = (g: HistoryGame) => {
    if (!tag || loading) return;
    setLoading(g.battleTime);
    fetch(`/api/bubble/review?tag=${encodeURIComponent(tag)}&lang=${encodeURIComponent(lang)}&game=${encodeURIComponent(g.battleTime)}`)
      .then((r) => r.json())
      .then((d: { game: PostGameReview | null }) => {
        if (d.game) {
          setOpen(d.game);
          panelTrack('panel_history_game', { result: g.result });
        } else {
          haptic('error');
        }
      })
      .catch(() => haptic('error'))
      .finally(() => setLoading(null));
  };

  if (open) {
    return <PanelReview review={open} roster={roster} modeArt={modeArt} onClose={() => setOpen(null)} onCounters={onCounters} />;
  }

  const face = (s: Side, size: number, ring: boolean) => {
    const b = byId.get(s.id);
    return (
      <span key={`${s.id}-${s.you ? 'y' : ''}`} className="relative shrink-0" title={b ? name(b.brawlerName) : undefined}>
        {b ? (
          <Image
            src={b.imageUrl}
            alt=""
            width={size}
            height={size}
            unoptimized
            className={`rounded-md border bg-surface-3 ${ring ? 'border-[#ffc53d] ring-1 ring-[#ffc53d]' : 'border-ink'}`}
            style={{ width: size, height: size }}
          />
        ) : (
          <span className="block rounded-md bg-surface-3" style={{ width: size, height: size }} />
        )}
        {s.star ? <Star className="absolute -right-1 -top-1 size-2.5 fill-[#ffc53d] text-[#ffc53d]" aria-hidden /> : null}
      </span>
    );
  };

  const list = games ?? [];
  const wins = list.filter((g) => g.result === 'victory').length;
  const stars = list.filter((g) => g.mine.some((p) => p.you && p.star)).length;
  let best = 0;
  let run = 0;
  for (const g of [...list].reverse()) {
    run = g.result === 'victory' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const dayKey = (d: Date) => d.toLocaleDateString('en-CA');
  const today = dayKey(new Date(now));
  const yesterday = dayKey(new Date(now - 86_400_000));
  const dayLabel = (d: Date) => {
    const k = dayKey(d);
    if (k === today) return t('history.today');
    if (k === yesterday) return t('history.yesterday');
    return d.toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const groups: { label: string; games: HistoryGame[] }[] = [];
  for (const g of list) {
    const d = when(g.battleTime);
    const label = d ? dayLabel(d) : '';
    const last = groups.at(-1);
    if (last && last.label === label) last.games.push(g);
    else groups.push({ label, games: [g] });
  }

  return (
    <div className="space-y-2 px-1">
      {/* Header: back, title, the run in numbers. */}
      <div className="bz-panel flex items-center gap-2 px-2 py-2">
        <button type="button" onClick={onClose} className="bz-chip grid size-8 shrink-0 place-items-center p-0" aria-label={t('history.back')}>
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="min-w-0 flex-1">
          <span className="display block truncate text-[15px] leading-tight">{t('history.title')}</span>
          {list.length > 0 ? (
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
              <span>
                <span className="font-bold text-victory">{wins}</span>–<span className="font-bold text-defeat">{list.length - wins}</span>
              </span>
              <span className="font-bold text-foreground">{Math.round((wins / list.length) * 100)}%</span>
              {best >= 2 ? (
                <span className="flex items-center gap-0.5 font-bold text-[#ff9b3d]">
                  <Flame className="size-3 fill-current" aria-hidden />
                  {t('history.bestStreak', { n: best })}
                </span>
              ) : null}
              {stars > 0 ? (
                <span className="flex items-center gap-0.5 font-bold text-[#ffc53d]">
                  <Star className="size-3 fill-current" aria-hidden />
                  {stars}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      </div>

      {/* The run as a strip, oldest to newest. */}
      {list.length > 1 ? (
        <div className="flex gap-[3px] px-1" aria-hidden>
          {[...list].reverse().map((g) => (
            <span
              key={g.battleTime}
              className="h-2 flex-1 rounded-sm"
              style={{ background: g.result === 'victory' ? 'var(--victory)' : 'var(--defeat)', opacity: 0.9 }}
            />
          ))}
        </div>
      ) : null}

      {!tag ? (
        <p className="bz-panel px-3 py-3 text-[12px] text-muted">{t('history.noTag')}</p>
      ) : games === null && !failed ? (
        <div className="space-y-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="bz-panel px-3 py-3 text-[12px] text-muted">{failed ? t('history.unavailable') : t('history.empty')}</p>
      ) : (
        <>
          <p className="px-1 text-[10px] text-muted">{t('history.hint')}</p>
          {groups.map((group) => (
            <section key={group.label} className="space-y-1.5">
              <p className="label-game px-1 pt-1 text-[10px] uppercase tracking-wide text-muted">{group.label}</p>
              {group.games.map((g) => {
                const won = g.result === 'victory';
                const me = g.mine.find((p) => p.you) ?? g.mine[0];
                const art = g.mode ? modeArt[g.mode.toLowerCase()] : undefined;
                const at = when(g.battleTime);
                const busy = loading === g.battleTime;
                return (
                  <button
                    key={g.battleTime}
                    type="button"
                    onClick={() => openGame(g)}
                    data-pending={busy ? '' : undefined}
                    className="bz-panel relative flex w-full items-center gap-2.5 overflow-hidden py-2 pe-2 ps-3 text-start"
                  >
                    <span aria-hidden className="absolute inset-y-0 start-0 w-1" style={{ background: won ? 'var(--victory)' : 'var(--defeat)' }} />
                    {me ? face(me, 34, false) : null}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black uppercase ${won ? 'text-victory' : 'text-defeat'}`}>
                          {won ? t('history.win') : t('history.loss')}
                        </span>
                        <span className="display truncate text-[13px] leading-tight text-[#a3eaff]">{g.mapName ? name(g.mapName) : ''}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                        {art?.icon ? <Image src={art.icon} alt="" width={12} height={12} unoptimized className="size-3" /> : null}
                        <span className="truncate">{art ? name(art.label) : ''}</span>
                        {at ? <span className="shrink-0">· {at.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}</span> : null}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      {g.mine.map((p) => face(p, 18, Boolean(p.you)))}
                      <span className="px-0.5 text-[9px] font-black uppercase text-muted">vs</span>
                      {g.theirs.map((p) => face(p, 18, false))}
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
