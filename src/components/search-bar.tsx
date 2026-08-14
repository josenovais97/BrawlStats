'use client';

import { Loader2, Search, Shield, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';

import { RecentSearches } from '@/components/recent-searches';
import { isValidTag, normalizeTag } from '@/lib/tags';

type Mode = 'player' | 'club';

interface SearchBarProps {
  defaultMode?: Mode;
  autoFocus?: boolean;
  /** Shows tags previously looked up on this device. */
  showRecent?: boolean;
}

/**
 * Client-side tag entry. Validation happens here so obvious typos never reach
 * the API, but this component never touches the API itself — it just navigates
 * to a server-rendered page.
 */
export function SearchBar({
  defaultMode = 'player',
  autoFocus = false,
  showRecent = false,
}: SearchBarProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const tag = normalizeTag(value);

    if (!tag) {
      setError('Enter a tag to search.');
      return;
    }
    if (!isValidTag(tag)) {
      setError('Tags only use the characters 0289PYLQGRJCUV — check for typos.');
      return;
    }

    setError(null);
    startTransition(() => {
      router.push(`/${mode}/${tag}`);
    });
  }

  return (
    <div id="search" className="w-full scroll-mt-24">
      <div className="mb-3 flex gap-2">
        {(['player', 'club'] as const).map((m) => {
          const Icon = m === 'player' ? User : Shield;
          return (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                mode === m
                  ? 'bg-brand text-[#1a1200]'
                  : 'border border-border text-muted hover:text-foreground'
              }`}
            >
              <Icon className="size-4" />
              {m}
            </button>
          );
        })}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted">
            #
          </span>
          <input
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder={mode === 'player' ? '2V0UL0GQV8' : '808VR8JGR'}
            aria-label={`${mode} tag`}
            aria-invalid={error ? true : undefined}
            spellCheck={false}
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full rounded-xl border border-border bg-surface py-3.5 pl-9 pr-4 font-mono text-lg uppercase tracking-wider outline-none transition-colors placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/60 focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-bold text-[#1a1200] transition-colors hover:bg-brand-strong disabled:opacity-70"
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Search className="size-5" />
          )}
          Search
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-defeat">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Find your tag in-game under your profile, below your name.
        </p>
      )}

      {showRecent ? <RecentSearches /> : null}
    </div>
  );
}
