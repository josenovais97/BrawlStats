'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PanelComps, type PanelModeComps } from '@/components/bubble/panel-comps';
import { remember, STORED_MAP, STORED_MODE, useModeLabel } from '@/components/bubble/panel-chips';
import { PanelCounters } from '@/components/bubble/panel-counters';
import { PanelDraft, type DraftBrawler } from '@/components/bubble/panel-draft';
import { LanguagePicker, usePanelI18n } from '@/components/bubble/panel-i18n';
import { PanelTiers, type PanelMode } from '@/components/bubble/panel-tiers';
import { PanelTrophies } from '@/components/bubble/panel-trophies';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';
import { useLastRankedGame, useSinceTagRecord, type PanelSeason } from '@/components/bubble/panel-record';
import { PanelClub } from '@/components/bubble/panel-club';
import { PanelHistory } from '@/components/bubble/panel-history';
import { PanelReview, type PostGameReview } from '@/components/bubble/panel-review';
import { BarChart3, Check, ChevronDown, History, LayoutGrid, MoreVertical, Search, Shield, Sparkles, Trophy, Users, X } from 'lucide-react';
import { PanelAsk } from '@/components/bubble/panel-ask';
import { rankProgress, winsToNext, type EloRate } from '@/lib/ranked-elo';
import { panelTrack, panelTrackOpen } from '@/lib/panel-telemetry';
import { usePanelTheme } from '@/components/bubble/panel-theme';

/**
 * Two views of the same draft, and which one is showing.
 *
 * Meta is the default and stays the default. It is the view that answers a
 * question with no setup — open the bubble, see what is strong — and most
 * openings want exactly that. The draft board is the deeper tool: it needs a
 * map, and it gets better the more of the line-up you feed it, which is work a
 * reader should opt into rather than be handed.
 *
 * The choice is remembered, so someone who drafts with the board every game
 * does not re-select the tab every game, and someone who never opens it never
 * sees it again after the first look.
 *
 * Both tabs mount lazily in the sense that matters: the draft board fetches
 * nothing until a map is chosen, so carrying it costs a component and no
 * requests.
 */

const STORED_TAB = 'brawlzone.bubble.tab';

type Tab = 'meta' | 'comps' | 'draft' | 'counters' | 'trophies';

export function PanelShell({
  modes,
  roster,
  windowDays,
  comps,
  season = null,
  modeArt = {},
  eloRates = {},
  trend = {},
}: {
  modes: PanelMode[];
  roster: DraftBrawler[];
  windowDays: number;
  comps: Record<string, PanelModeComps>;
  season?: PanelSeason | null;
  /** Every mode's name and art by lower-cased battle-log key, for the form chips. */
  modeArt?: Record<string, { label: string; icon: string | null }>;
  /** Elo per Ranked win and loss by rank group, for "≈ N wins" (lib/ranked-elo). */
  eloRates?: Record<string, EloRate>;
  /** The week's biggest risers (1) and fallers (-1) for the Meta arrows. */
  trend?: Record<number, 1 | -1>;
}) {
  /*
   * Nothing until the reader chooses.

   * A first opening used to land on Meta with the full tier list already
   * drawn -- a wall of brawlers before anyone had said what they wanted. With
   * no saved choice the panel now asks first; after one tap that choice is
   * remembered, so every later opening goes straight to it.
   */
  const [tab, setTab] = useState<Tab | null>(null);
  usePanelTheme();

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORED_TAB);
      if (saved === 'meta' || saved === 'draft' || saved === 'comps' || saved === 'counters' || saved === 'trophies') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTab(saved);
      }
    } catch {
      // Private windows and blocked site data both throw. The chooser is a
      // fine outcome; a panel that fails to render is not.
    }
  }, []);

  const choose = (next: Tab) => {
    if (next !== tab) panelTrack('panel_tab', { tab: next });
    setTab(next);
    try {
      window.localStorage.setItem(STORED_TAB, next);
    } catch {
      // ignored
    }
  };

  /*
   * The app's shortcuts (1.40): long-press the icon, "Counters", and the
   * bubble opens the panel on that tab. A fresh page reads `tab=` from the
   * hash; a page the app already holds is switched through this hook.
   */
  // Match history (2026-11-13): over the panel until closed, like the review.
  const [historyOpen, setHistoryOpen] = useState(false);
  // Ask Bubble (2026-11-19): the question box, over the whole panel like the review.
  const [askOpen, setAskOpen] = useState(false);
  const chooseRef = useRef(choose);
  useEffect(() => {
    chooseRef.current = choose;
  });
  useEffect(() => {
    const open = (next: string) => {
      if (next === 'history') setHistoryOpen(true);
      else if (next === 'ask') setAskOpen(true);
      else if (next === 'meta' || next === 'draft' || next === 'comps' || next === 'counters' || next === 'trophies') chooseRef.current(next);
    };
    (window as unknown as { __bzOpenTab?: (t: string) => void }).__bzOpenTab = open;
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('tab');
    if (fromHash) open(fromHash);
    return () => {
      delete (window as unknown as { __bzOpenTab?: (t: string) => void }).__bzOpenTab;
    };
  }, []);

  /*
   * The post-game review (1.40): the app hands it over when the bubble that
   * pulsed after a Ranked game is tapped, and it covers the panel until closed.
   */
  const [review, setReview] = useState<PostGameReview | null>(null);

  useEffect(() => {
    const w = window as unknown as { __bzShowReview?: (r: PostGameReview) => void };
    w.__bzShowReview = (r) => {
      if (r && Array.isArray(r.mine) && Array.isArray(r.theirs)) {
        setReview(r);
        panelTrack('panel_review', { result: r.result });
        // Tells the app the bubble's badge can go.
        try {
          (window as unknown as { BrawlZoneApp?: { reviewSeen?: () => void } }).BrawlZoneApp?.reviewSeen?.();
        } catch {
          // An older app without the hook.
        }
      }
    };
    return () => {
      delete w.__bzShowReview;
    };
  }, []);
  /*
   * "Draft on this map" from a review (1.43): an empty board on that map,
   * then the Draft tab. The draft restores what storage says, so the board is
   * written there first.
   */
  const draftOn = (mode: string, mapName: string) => {
    remember(STORED_MODE, mode);
    remember(STORED_MAP, mapName);
    try {
      window.localStorage.setItem(
        'brawlzone.bubble.draft',
        JSON.stringify({ map: mapName, at: Date.now(), bans: [], allies: [], enemies: [], mine: null }),
      );
    } catch {
      // ignored
    }
    setReview(null);
    setHistoryOpen(false);
    choose('draft');
  };
  const reviewCounters = (brawlerId: number) => {
    const w = window as unknown as { __bzPendingCounter?: number; __bzOpenCounter?: (id: number) => void };
    w.__bzPendingCounter = brawlerId;
    w.__bzOpenCounter?.(brawlerId);
    setReview(null);
    choose('counters');
  };

  const account = useBubbleAccount();
  const { t, lang, name } = usePanelI18n();
  const { record, form } = useSinceTagRecord(account.tag);
  // The player card opens a small drawer: rank progress and form by mode.
  const [cardOpen, setCardOpen] = useState(false);
  // The ⋯ menu (1.43): season line, History and the language.
  const [moreOpen, setMoreOpen] = useState(false);
  const progress = rankProgress(account.elo);
  const winsNeeded = winsToNext(progress, eloRates);
  const lastGame = useLastRankedGame(account.tag, cardOpen);
  const portrait = useMemo(() => new Map(roster.map((b) => [b.brawlerId, b])), [roster]);
  const modeName = useModeLabel();
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(lang, { month: 'short', day: 'numeric', timeZone: 'UTC' });

  // One open per panel, with the tab it opened on and whether a tag is set --
  // a yes/no, never the tag. Read after the saved tab has been restored.
  // The language too, so the dashboard says which ones are actually used.
  const latest = useRef({ tab: tab ?? 'none', hasTag: account.tag !== null, lang });
  useEffect(() => {
    latest.current = { tab: tab ?? 'none', hasTag: account.tag !== null, lang };
  });
  useEffect(() => panelTrackOpen(() => latest.current), []);
  const filterLabel =
    account.filter === 'power11'
      ? t('filter.power11')
      : account.filter === 'hypercharge'
        ? t('filter.hypercharge')
        : t('filter.owned');

  if (review) {
    return (
      <div data-panel-overlay>
        <PanelReview
          key={review.battleTime}
          review={review}
          roster={roster}
          modeArt={modeArt}
          modes={modes}
          onClose={() => setReview(null)}
          onCounters={reviewCounters}
          onDraft={draftOn}
        />
      </div>
    );
  }
  if (askOpen) {
    return (
      <div data-panel-overlay>
        <PanelAsk
          modes={modes}
          roster={roster}
          comps={comps}
          onClose={() => setAskOpen(false)}
          onCounters={(id) => {
            setAskOpen(false);
            reviewCounters(id);
          }}
        />
      </div>
    );
  }
  if (historyOpen) {
    return (
      <div data-panel-overlay>
        <PanelHistory
          modes={modes}
          onDraft={draftOn}
          roster={roster}
          modeArt={modeArt}
          onClose={() => setHistoryOpen(false)}
          onCounters={(id) => {
            setHistoryOpen(false);
            reviewCounters(id);
          }}
        />
      </div>
    );
  }

  /*
   * The Ranked season in one line: when it ends, its trial brawlers, and the
   * record since the tag. Lives in the player drawer and the ⋯ menu since
   * 1.43, where it no longer costs a row above every answer.
   */
  const seasonLine = season ? (
    <div className="flex items-center gap-1.5 overflow-hidden text-[10px] text-muted">
      <span className="truncate font-semibold">
        {season.endsOn ? t('season.ends', { n: season.number, date: shortDate(season.endsOn) }) : `S${season.number}`}
      </span>
      {season.trial.length > 0 ? (
        <>
          <span className="shrink-0">· {t('season.trial')}</span>
          {season.trial.slice(0, 4).map((b) => (
            <Image key={b.name} src={b.imageUrl} alt={b.name} title={b.name} width={16} height={16} className="size-4 shrink-0 rounded-sm bg-surface-2" unoptimized />
          ))}
        </>
      ) : null}
      {record && record.wins + record.losses > 0 ? (
        <span className="ms-auto flex shrink-0 items-center gap-0.5" title={t('record.title', { w: record.wins, l: record.losses })}>
          <Check className="size-3 text-victory" aria-hidden />
          <span className="font-bold tabular-nums text-victory">{record.wins}</span>
          <X className="size-3 text-defeat" aria-hidden />
          <span className="font-bold tabular-nums text-defeat">{record.losses}</span>
          <span>&nbsp;{t('record.since', { date: shortDate(record.since) })}</span>
        </span>
      ) : null}
    </div>
  ) : null;

  const openAsk = (from: string) => {
    setAskOpen(true);
    panelTrack('panel_ask_open', { from });
  };

  return (
    <>
      {/*
        Whose panel this is, in one row (1.43).

        With a tag: the player's icon and name (tap for the drawer), the filter
        in force, then Ask and the ⋯ menu. Without one, a single short line
        pointing at the app. The language, the season line and History moved
        into ⋯ so the answer starts higher in a window ~340dp tall.
      */}
      <div className="relative">
      <div className="mx-1 mb-1.5 flex items-center gap-1.5">
        {account.tag ? (
          <>
            {account.iconUrl ? (
              <Image
                src={account.iconUrl}
                alt=""
                width={28}
                height={28}
                className="size-7 shrink-0 rounded-lg border-2 border-brand bg-surface-2"
                unoptimized
              />
            ) : (
              <span className="size-7 shrink-0 rounded-lg border-2 border-brand bg-surface-2" />
            )}
            <button
              type="button"
              onClick={() => setCardOpen((v) => !v)}
              aria-expanded={cardOpen}
              className="min-w-0 flex-1 text-start leading-tight"
            >
              <span className="flex items-center gap-1">
                <span className="display truncate text-[13px]">{account.name ?? `#${account.tag}`}</span>
                <ChevronDown className={`size-3.5 shrink-0 text-muted transition-transform ${cardOpen ? 'rotate-180' : ''}`} aria-hidden />
              </span>
              {form && form.games > 0 ? (
                <span className="flex items-center gap-1 truncate text-[10px] text-muted">
                  <span className="shrink-0">{t('record.last', { n: form.games })}</span>
                  <Check className="size-3 shrink-0 text-victory" aria-hidden />
                  <span className="font-bold tabular-nums text-victory">{form.wins}</span>
                  <X className="size-3 shrink-0 text-defeat" aria-hidden />
                  <span className="font-bold tabular-nums text-defeat">{form.losses}</span>
                  <span className="shrink-0 font-bold tabular-nums text-foreground">· {Math.round((form.wins / form.games) * 100)}%</span>
                  {form.stars > 0 ? (
                    <span className="shrink-0 font-bold tabular-nums text-brand" title={t('record.starTitle', { n: form.stars, g: form.games })}>
                      · ★{form.stars}
                    </span>
                  ) : null}
                  {form.streak >= 2 ? (
                    <span className="shrink-0 font-bold tabular-nums text-[#ff9b3d]" title={t('record.streakTitle', { n: form.streak })}>
                      · 🔥{form.streak}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="block truncate text-[10px] text-muted">#{account.tag}</span>
              )}
            </button>
            <span className="bz-chip-on shrink-0 px-1.5 py-0.5 text-[10px]">
              {filterLabel}
              {account.hide ? ` · ${t('filter.hiding')}` : ''}
            </span>
          </>
        ) : (
          <p className="min-w-0 flex-1 truncate text-[11px] text-muted">{t('account.noTagShort')}</p>
        )}
        {/* Ask Bubble, as the panel's search (1.43): violet, so it never reads as a tab. */}
        <button
          type="button"
          onClick={() => openAsk('tabs')}
          aria-label={t('ask.title')}
          title={t('ask.title')}
          className="grid size-8 shrink-0 place-items-center rounded-[10px] border-2 border-[#050a1f] bg-gradient-to-b from-[#c9a8ff] to-[#7a4cff] text-white shadow-[inset_0_2px_0_rgb(255_255_255/0.45),0_2px_0_#050a1f]"
        >
          <Search className="size-4" strokeWidth={3} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-label={t('more.title')}
          title={t('more.title')}
          className="bz-chip grid h-8 w-7 shrink-0 place-items-center p-0"
        >
          <MoreVertical className="size-4" aria-hidden />
        </button>
      </div>

      {moreOpen ? (
        <>
          <button
            type="button"
            aria-label={t('review.close')}
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-[#050a1f]/40"
          />
          <div className="bz-panel absolute end-1 top-10 z-50 w-[min(18rem,calc(100%-0.5rem))] space-y-2 p-2">
            {seasonLine}
            {account.tag ? (
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  setHistoryOpen(true);
                }}
                className="bz-chip flex w-full items-center gap-2 px-3 py-2 text-start text-[13px]"
              >
                <History className="size-4 shrink-0" aria-hidden />
                {t('history.open')}
              </button>
            ) : null}
            <LanguagePicker variant="row" />
          </div>
        </>
      ) : null}

      {account.tag && cardOpen ? (
        <div className="bz-panel mx-1 mb-2 space-y-1.5 px-2 py-1.5 text-[10px]">
          {seasonLine}
          {progress ? (

            <div className="flex items-center gap-2">
              <span className="shrink-0 font-bold">{progress.rank}</span>
              <span className="shrink-0 tabular-nums text-muted">{t('record.elo', { n: progress.elo.toLocaleString(lang) })}</span>
              <span className="relative h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-black/30">
                <span className="absolute inset-y-0 start-0 rounded-full bg-brand" style={{ width: `${Math.round(progress.share * 100)}%` }} />
              </span>
              {progress.next && progress.toNext !== null ? (
                <span className="shrink-0 tabular-nums text-muted">
                  {t('record.toNext', { n: progress.toNext.toLocaleString(lang), rank: progress.next })}
                  {winsNeeded !== null && winsNeeded >= 2 ? (
                    <span className="font-bold text-foreground"> · {t('record.winsToNext', { n: winsNeeded.toLocaleString(lang) })}</span>
                  ) : null}
                </span>
              ) : null}
            </div>
          ) : null}
          {form && form.byMode.length > 0 ? (
            <ul className="flex flex-wrap gap-1">
              {form.byMode.map((m) => {
                const pm = modes.find((x) => x.key === m.mode);
                const art = modeArt[m.mode.toLowerCase()];
                const icon = pm?.icon ?? art?.icon ?? null;
                const label = pm ? modeName(pm) : art ? name(art.label) : m.mode;
                return (
                  <li
                    key={m.mode}
                    className="inline-flex items-center gap-1 rounded-md bg-surface-2/70 px-1.5 py-0.5"
                    title={label}
                  >
                    {icon ? (
                      <Image src={icon} alt={label} width={14} height={14} className="size-3.5 object-contain" unoptimized />
                    ) : (
                      <span className="text-muted">{label}</span>
                    )}
                    <span className={`font-bold tabular-nums ${m.wins > m.losses ? 'text-victory' : m.wins < m.losses ? 'text-defeat' : 'text-foreground'}`}>
                      {m.wins}–{m.losses}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {lastGame ? (
            <div className="space-y-1 border-t border-border/60 pt-1.5">
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className={`font-black ${lastGame.result === 'victory' ? 'text-victory' : 'text-defeat'}`}>
                  {lastGame.result === 'victory' ? '✓' : '✗'}
                </span>
                <span className="font-bold">{t('review.last')}</span>
                {lastGame.mode && modeArt[lastGame.mode.toLowerCase()]?.icon ? (
                  <Image src={modeArt[lastGame.mode.toLowerCase()]!.icon!} alt="" width={12} height={12} className="size-3 object-contain" unoptimized />
                ) : null}
                <span className="text-muted">{lastGame.mapName ? name(lastGame.mapName) : ''}</span>
                {lastGame.winChance !== null ? (
                  lastGame.winChance >= 0.45 && lastGame.winChance <= 0.55 ? (
                    <span className="text-muted">· {t('review.even')}</span>
                  ) : (
                    <span className={lastGame.winChance > 0.55 ? 'text-victory' : 'text-defeat'}>
                      · {t('review.chance', { pct: `${Math.round(lastGame.winChance * 100)}%` })}
                    </span>
                  )
                ) : null}
              </p>
              {lastGame.worst ? (
                <p className="flex items-center gap-1 text-muted">
                  {t('review.worst')}
                  {[lastGame.worst.brawlerId, lastGame.worst.againstId].map((id, i) => {
                    const b = portrait.get(id);
                    return (
                      <span key={id} className="inline-flex items-center gap-0.5">
                        {i === 1 ? <span className="px-0.5">vs</span> : null}
                        {b ? <Image src={b.imageUrl} alt="" width={16} height={16} className="size-4 rounded" unoptimized /> : null}
                        <span className="font-semibold text-foreground">{b ? name(b.brawlerName) : id}</span>
                      </span>
                    );
                  })}
                  <span className="font-bold tabular-nums text-defeat">{lastGame.worst.edge.toFixed(1)}</span>
                </p>
              ) : null}
            </div>
          ) : null}
          {/* The club by Ranked elo (2026-11-13), loaded only when the card opens. */}
          <PanelClub tag={account.tag} />
        </div>
      ) : null}
      </div>

      {/* Five tabs with icons (1.43): the icon reads faster than the word, and
          short words stop "Team comp" being cut to "Teamco…". */}
      <div role="tablist" aria-label="Panel view" className="mb-2 flex gap-1 px-1">
        {(
          [
            ['meta', t('tab.meta'), BarChart3],
            ['comps', t('tab.comps'), Users],
            ['draft', t('tab.draft'), LayoutGrid],
            ['counters', t('tab.counters'), Shield],
            ['trophies', t('tab.trophies'), Trophy],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => choose(key)}
            className={`inline-flex min-w-0 flex-auto items-center justify-center gap-1 px-1.5 py-1.5 text-[12px] leading-tight ${
              tab === key ? 'bz-chip-on' : 'bz-chip'
            }`}
          >
            <Icon className="size-3.5 shrink-0" strokeWidth={2.6} aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {tab === null ? (
        <div className="bz-panel mx-1 px-3 py-3">
          <p className="display text-base uppercase">{t('chooser.title')}</p>
          <p className="mt-0.5 text-[11px] text-muted">{t('chooser.sub')}</p>
          <ul className="mt-2.5 space-y-2">
            {(
              [
                ['meta', t('tab.meta'), t('chooser.meta')],
                ['comps', t('tab.comps'), t('chooser.comps')],
                ['draft', t('tab.draft'), t('chooser.draft')],
                ['counters', t('tab.counters'), t('chooser.counters')],
                ['trophies', t('tab.trophies'), t('chooser.trophies')],
              ] as const
            ).map(([key, label, hint]) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => choose(key)}
                  className="bz-chip flex w-full flex-col items-start px-3 py-2 text-start"
                >
                  <span className="text-[14px] leading-tight">{label}</span>
                  <span className="mt-0.5 font-sans text-[11px] font-normal leading-snug text-muted [text-shadow:none]">
                    {hint}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => openAsk('chooser')}
            className="mt-2 flex w-full items-center gap-2 rounded-[10px] border-2 border-[#050a1f] bg-gradient-to-b from-[#9f7bff] to-[#5b34d6] px-3 py-2 text-start text-white"
          >
            <Sparkles className="size-4 shrink-0" aria-hidden />
            <span className="flex flex-col">
              <span className="display text-[14px] leading-tight">{t('ask.title')}</span>
              <span className="mt-0.5 font-sans text-[11px] font-normal leading-snug text-white/80 [text-shadow:none]">{t('chooser.ask')}</span>
            </span>
          </button>
          {/* The first screen anyone sees, so the language setting is spelled
              out here as well as sitting in the corner as a flag. */}
          <div className="mt-3 border-t border-border pt-2.5">
            <LanguagePicker variant="row" />
          </div>
        </div>
      ) : tab === 'meta' ? (
        <PanelTiers modes={modes} windowDays={windowDays} trend={trend} />
      ) : tab === 'comps' ? (
        <PanelComps modes={modes} comps={comps} />
      ) : tab === 'counters' ? (
        <PanelCounters modes={modes} roster={roster} />
      ) : tab === 'trophies' ? (
        <PanelTrophies />
      ) : (
        <PanelDraft modes={modes} roster={roster} />
      )}
    </>
  );
}
