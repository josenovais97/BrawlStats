'use client';

import { Loader2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, useTransition, type FormEvent, type ReactNode } from 'react';

import { ClubIcon, PlayersIcon } from '@/components/game-icons';
import { RecentSearches } from '@/components/recent-searches';
import { playerIconUrl } from '@/lib/brawlapi';
import type { NameMatch } from '@/lib/player-search';
import { isValidTag, normalizeTag } from '@/lib/tags';
import { TagLocationHint } from '@/components/tag-location-hint';
import { useLocale } from '@/components/i18n/use-locale';
import { useT } from '@/components/i18n/use-t';
import { localePath } from '@/lib/i18n';

type Mode = 'player' | 'club';

interface SearchBarProps {
  defaultMode?: Mode;
  autoFocus?: boolean;
  /** Shows tags previously looked up on this device. */
  showRecent?: boolean;
  /**
   * `hero` is the landing-page treatment: larger type, a full-width submit on
   * mobile and more generous padding. `default` stays compact for the places
   * the search sits inside another page.
   */
  size?: 'default' | 'hero';
  /**
   * Rendered under the hint and above the recent row, for a secondary action
   * that belongs to the search rather than to the page around it.
   */
  footer?: ReactNode;
}

const CLUB_PLACEHOLDER = '808VR8JGR';

/**
 * Client-side tag entry. Validation happens here so obvious typos never reach
 * the API, but this component never touches the API itself — it just navigates
 * to a server-rendered page.
 */
export function SearchBar({
  defaultMode = 'player',
  autoFocus = false,
  showRecent = false,
  size = 'default',
  footer,
}: SearchBarProps) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hintId = useId();
  // Name search (2026-10-28, lib/player-search): players only, as you type.
  const [matches, setMatches] = useState<NameMatch[] | null>(null);
  const query = value.trim();

  useEffect(() => {
    if (mode !== 'player' || [...query].length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale results as the query changes
      setMatches(null);
      return;
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/players/search?q=${encodeURIComponent(query)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { players: [] }))
        .then((d: { players?: NameMatch[] }) => setMatches(d.players ?? []))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [mode, query]);

  const hero = size === 'hero';

  function open(tag: string) {
    startTransition(() => {
      router.push(localePath(locale, `/player/${tag}`));
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const tag = normalizeTag(value);

    if (!tag) {
      setError(mode === 'player' ? t('Enter your name or tag to search.') : t('Enter a tag to search.'));
      return;
    }
    if (!isValidTag(tag)) {
      if (mode === 'player' && matches?.length) {
        setError(t('Pick your profile from the list below.'));
      } else if (mode === 'player' && matches) {
        setError(t('No player with that name here yet. Search once with your tag, and your name will work next time.'));
      } else {
        setError(t('Tags only use the characters 0289PYLQGRJCUV, so check for typos.'));
      }
      return;
    }

    setError(null);
    startTransition(() => {
      router.push(localePath(locale, `/${mode}/${tag}`));
    });
  }

  return (
    <div id="search" className="w-full scroll-mt-24">
      {/*
        Segmented control rather than two loose buttons: the sliding pill makes
        it obvious the two options are one setting with one active value.
      */}
      <div
        role="group"
        aria-label={t('Search type')}
        className="inline-flex rounded-xl border border-border/80 bg-background/70 p-1 shadow-[inset_0_1px_3px_rgb(0_0_0/0.5)]"
      >
        {(['player', 'club'] as const).map((m) => {
          const isClub = m === 'club';
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold capitalize transition-colors ${
                active
                  ? 'bg-brand text-brand-ink shadow-[0_1px_2px_rgb(0_0_0/0.35)]'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {isClub ? <ClubIcon className="size-4" /> : <PlayersIcon className="size-4" />}
              {t(m)}
            </button>
          );
        })}
      </div>

      <form
        onSubmit={onSubmit}
        className={`mt-3 flex flex-col gap-3 ${hero ? 'sm:flex-row' : 'sm:flex-row'}`}
      >
        {/*
          The focus ring lives on this wrapper, not the input, so the whole
          field including the leading hash lights up as one control.
        */}
        <div className="group relative flex-1 rounded-xl transition-shadow duration-200 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand)_22%,transparent)]">
          {mode === 'club' ? (
            <span
              aria-hidden
              className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-muted transition-colors group-focus-within:text-brand ${
                hero ? 'text-xl' : 'text-lg'
              }`}
            >
              #
            </span>
          ) : null}
          <input
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder={mode === 'player' ? t('Your name or tag') : CLUB_PLACEHOLDER}
            aria-label={mode === 'player' ? t('Player name or tag') : t('club tag')}
            aria-invalid={error ? true : undefined}
            aria-describedby={hintId}
            spellCheck={false}
            autoCapitalize={mode === 'player' ? 'none' : 'characters'}
            autoComplete="off"
            enterKeyHint="search"
            className={`w-full rounded-xl border bg-background/70 ${mode === 'club' ? 'font-mono uppercase tracking-wider' : 'font-semibold'} shadow-[inset_0_2px_6px_rgb(0_0_0/0.45)] outline-none transition-colors placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/85 focus:border-brand/80 ${
              error ? 'border-defeat/60' : 'border-border-strong/60'
            } ${hero ? `py-4 ${mode === 'club' ? 'pl-11' : 'pl-5'} pr-4 text-lg sm:text-xl` : `py-3.5 ${mode === 'club' ? 'pl-9' : 'pl-4'} pr-4 text-lg`}`}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className={`btn-game inline-flex shrink-0 items-center justify-center gap-2 bg-brand uppercase text-brand-ink hover:bg-brand-strong disabled:opacity-70 ${
            hero ? 'px-8 py-4 text-lg' : 'px-7 py-3.5 text-lg'
          }`}
        >
          {pending ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />}
          {t('Search')}
        </button>
      </form>

      {mode === 'player' && matches?.length ? (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          {matches.map((m) => (
            <li key={m.tag}>
              <button
                type="button"
                onClick={() => open(m.tag)}
                data-umami-event="name_search_pick"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a small CDN icon, as in RecentSearches */}
                <img src={playerIconUrl(m.iconId ?? undefined)} alt="" width={36} height={36} className="size-9 shrink-0 rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m.name}</span>
                  <span className="block font-mono text-xs text-muted">#{m.tag}</span>
                </span>
                {m.trophies !== null ? (
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-muted">🏆 {m.trophies.toLocaleString(locale)}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-defeat">
          {error}
        </p>
      ) : (
        <div id={hintId} className="mt-3 text-sm text-muted">
          {mode === 'player'
            ? `${t('Your in-game name or #tag.')} `
            : `${t('A club tag is shown on the club screen, under the club name.')} `}
          <TagLocationHint kind={mode === 'player' ? 'player' : 'club'} />
        </div>
      )}

      {footer}

      {showRecent ? <RecentSearches /> : null}
    </div>
  );
}
