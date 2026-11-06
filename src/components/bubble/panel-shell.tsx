'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { PanelComps, type PanelModeComps } from '@/components/bubble/panel-comps';
import { useModeLabel } from '@/components/bubble/panel-chips';
import { PanelCounters } from '@/components/bubble/panel-counters';
import { PanelDraft, type DraftBrawler } from '@/components/bubble/panel-draft';
import { LanguagePicker, usePanelI18n } from '@/components/bubble/panel-i18n';
import { PanelTiers, type PanelMode } from '@/components/bubble/panel-tiers';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';
import { useSinceTagRecord, type PanelSeason } from '@/components/bubble/panel-record';
import { Check, ChevronDown, X } from 'lucide-react';
import { rankProgress } from '@/lib/ranked-elo';
import { panelTrack, panelTrackOpen } from '@/lib/panel-telemetry';

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

type Tab = 'meta' | 'comps' | 'draft' | 'counters';

export function PanelShell({
  modes,
  roster,
  windowDays,
  comps,
  season = null,
  modeArt = {},
}: {
  modes: PanelMode[];
  roster: DraftBrawler[];
  windowDays: number;
  comps: Record<string, PanelModeComps>;
  season?: PanelSeason | null;
  /** Every mode's name and art by lower-cased battle-log key, for the form chips. */
  modeArt?: Record<string, { label: string; icon: string | null }>;
}) {
  /*
   * Nothing until the reader chooses.

   * A first opening used to land on Meta with the full tier list already
   * drawn -- a wall of brawlers before anyone had said what they wanted. With
   * no saved choice the panel now asks first; after one tap that choice is
   * remembered, so every later opening goes straight to it.
   */
  const [tab, setTab] = useState<Tab | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORED_TAB);
      if (saved === 'meta' || saved === 'draft' || saved === 'comps' || saved === 'counters') {
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

  const account = useBubbleAccount();
  const { t, lang, name } = usePanelI18n();
  const { record, form } = useSinceTagRecord(account.tag);
  // The player card opens a small drawer: rank progress and form by mode.
  const [cardOpen, setCardOpen] = useState(false);
  const progress = rankProgress(account.elo);
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

  return (
    <>
      {/*
        Whose panel this is.

        With a tag set, the player's own icon and name, and the filter in
        force -- the panel marks and hides brawlers on their behalf, and a
        face at the top is how they know it is their roster being read and
        not someone else's. Without one, a single quiet line saying what a tag
        would add, pointing at the app where it is entered. Never a blocker:
        the panel works the same either way.
      */}
      <div>
      {account.tag ? (
        <div className="bz-panel mx-1 mb-2.5 flex items-center gap-2 px-2 py-1.5">
          {account.iconUrl ? (
            <Image
              src={account.iconUrl}
              alt=""
              width={28}
              height={28}
              className="size-8 shrink-0 rounded-lg border-2 border-brand bg-surface-2"
              unoptimized
            />
          ) : (
            <span className="size-8 shrink-0 rounded-lg border-2 border-brand bg-surface-2" />
          )}
          <button
            type="button"
            onClick={() => setCardOpen((v) => !v)}
            aria-expanded={cardOpen}
            className="min-w-0 flex-1 text-start leading-tight"
          >
            <span className="flex items-center gap-1">
              <span className="display truncate text-sm">{account.name ?? `#${account.tag}`}</span>
              {progress || (form && form.byMode.length > 0) ? (
                <ChevronDown className={`size-3.5 shrink-0 text-muted transition-transform ${cardOpen ? 'rotate-180' : ''}`} aria-hidden />
              ) : null}
            </span>
            {/* Recent form from the battle log (2026-11-06), in place of the
                tag once it has loaded: results, win rate, star player, streak. */}
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
          <LanguagePicker />
        </div>
      ) : (
        <div className="mx-1 mb-2 flex items-start gap-2">
          <p className="flex-1 rounded-md border border-dashed border-border px-2 py-1.5 text-[11px] leading-snug text-muted">
            {t('account.noTag')}
          </p>
          <LanguagePicker />
        </div>
      )}
      {account.tag && cardOpen && (progress || (form && form.byMode.length > 0)) ? (
        <div className="bz-panel mx-1 -mt-1 mb-2.5 space-y-1.5 px-2 py-1.5 text-[10px]">
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
        </div>
      ) : null}
      </div>

      {/*
        Two tabs, sized like the chips below them rather than like a phone's
        tab bar. A full-width segmented control would cost a row of a window
        that is only ~375dp tall in the orientation the game is played in.
      */}
      {/* The Ranked season in one line: when it ends, and its trial brawlers. */}
      {season ? (
        <div className="mx-1 mb-2 flex items-center gap-1.5 overflow-hidden text-[10px] text-muted">
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
            <span
              className="ms-auto flex shrink-0 items-center gap-0.5"
              title={t('record.title', { w: record.wins, l: record.losses })}
            >
              <Check className="size-3 text-victory" aria-hidden />
              <span className="font-bold tabular-nums text-victory">{record.wins}</span>
              <X className="size-3 text-defeat" aria-hidden />
              <span className="font-bold tabular-nums text-defeat">{record.losses}</span>
              <span>&nbsp;{t('record.since', { date: shortDate(record.since) })}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      <div role="tablist" aria-label="Panel view" className="mb-2.5 flex gap-1.5 px-1">
        {(
          [
            ['meta', t('tab.meta')],
            ['comps', t('tab.comps')],
            ['draft', t('tab.draft')],
            ['counters', t('tab.counters')],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => choose(key)}
            className={`min-w-0 flex-1 truncate px-1.5 py-1.5 text-[12px] leading-tight ${
              tab === key
                ? 'bz-chip-on'
                : 'bz-chip'
            }`}
          >
            {label}
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
          {/* The first screen anyone sees, so the language setting is spelled
              out here as well as sitting in the corner as a flag. */}
          <div className="mt-3 border-t border-border pt-2.5">
            <LanguagePicker variant="row" />
          </div>
        </div>
      ) : tab === 'meta' ? (
        <PanelTiers modes={modes} windowDays={windowDays} />
      ) : tab === 'comps' ? (
        <PanelComps modes={modes} comps={comps} />
      ) : tab === 'counters' ? (
        <PanelCounters modes={modes} roster={roster} />
      ) : (
        <PanelDraft modes={modes} roster={roster} />
      )}
    </>
  );
}
