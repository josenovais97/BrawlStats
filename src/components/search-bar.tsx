'use client';

import { ArrowRight, Loader2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useId,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from 'react';

import { ClubIcon, PlayersIcon } from '@/components/game-icons';
import { RecentSearches } from '@/components/recent-searches';
import { isValidTag, normalizeTag } from '@/lib/tags';
import { TagLocationHint } from '@/components/tag-location-hint';

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

const PLACEHOLDER: Record<Mode, string> = {
  player: '2V0UL0GQV8',
  club: '808VR8JGR',
};

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
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hintId = useId();

  const hero = size === 'hero';

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const tag = normalizeTag(value);

    if (!tag) {
      setError('Enter a tag to search.');
      return;
    }
    if (!isValidTag(tag)) {
      setError('Tags only use the characters 0289PYLQGRJCUV, so check for typos.');
      return;
    }

    setError(null);
    startTransition(() => {
      router.push(`/${mode}/${tag}`);
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
        aria-label="Search type"
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
              {m}
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
          <span
            aria-hidden
            className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-muted/70 transition-colors group-focus-within:text-brand ${
              hero ? 'text-xl' : 'text-lg'
            }`}
          >
            #
          </span>
          <input
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder={PLACEHOLDER[mode]}
            aria-label={`${mode} tag`}
            aria-invalid={error ? true : undefined}
            aria-describedby={hintId}
            spellCheck={false}
            autoCapitalize="characters"
            autoComplete="off"
            enterKeyHint="search"
            className={`w-full rounded-xl border bg-background/70 font-mono uppercase tracking-wider shadow-[inset_0_2px_6px_rgb(0_0_0/0.45)] outline-none transition-colors placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/40 focus:border-brand/80 ${
              error ? 'border-defeat/60' : 'border-border-strong/60'
            } ${hero ? 'py-4 pl-11 pr-4 text-lg sm:text-xl' : 'py-3.5 pl-9 pr-4 text-lg'}`}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className={`btn-game inline-flex shrink-0 items-center justify-center gap-2 bg-brand uppercase text-brand-ink hover:bg-brand-strong disabled:opacity-70 ${
            hero ? 'px-8 py-4 text-lg' : 'px-7 py-3.5 text-lg'
          }`}
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Search className="size-5" />
          )}
          Search
          {hero ? <ArrowRight className="size-5 sm:hidden" /> : null}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-defeat">
          {error}
        </p>
      ) : (
        <p id={hintId} className="mt-3 text-sm text-muted">
          {mode === 'player'
            ? 'Your tag is on your in-game profile, just below your profile icon. '
            : 'A club tag is shown on the club screen, under the club name. '}
          <TagLocationHint kind={mode === 'player' ? 'player' : 'club'} />
        </p>
      )}

      {footer}

      {showRecent ? <RecentSearches /> : null}
    </div>
  );
}
