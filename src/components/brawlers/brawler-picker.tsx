'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Searchable brawler combobox.
 *
 * A native select over 107 entries is the control the browser gives you for
 * free, and it is the reason this page looked borrowed: an OS dropdown with an
 * OS arrow and an OS focus ring, dropped between controls the site drew
 * itself. It is also genuinely worse to use — the list is alphabetical only if
 * you happen to know the name, and there is no way to type "sh" and see Shelly.
 *
 * Same shape as the region picker on the leaderboard, for the same reason and
 * with the same behaviour: filter as you type, close on Escape or an outside
 * click, and commit on click or Enter.
 */
export function BrawlerPicker({
  id,
  label,
  brawlers,
  value,
  onChange,
  /** Already taken by the other side of the comparison. */
  exclude,
}: {
  id: string;
  label: string;
  brawlers: { slug: string; name: string }[];
  value: string;
  onChange: (slug: string) => void;
  exclude?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = brawlers.filter((b) => b.slug !== exclude);
    return q ? pool.filter((b) => b.name.toLowerCase().includes(q)) : pool;
  }, [brawlers, exclude, query]);

  const selected = brawlers.find((b) => b.slug === value);

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <button
        id={id}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected?.name.toLowerCase() ?? 'none chosen'}`}
        className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 text-sm font-semibold capitalize transition-colors hover:border-brand/50"
      >
        <span className="flex-1 truncate text-left">
          {selected ? selected.name.toLowerCase() : 'Choose a brawler'}
        </span>
        <ChevronDown
          aria-hidden
          className={`size-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 z-50 mt-2 w-full min-w-[14rem] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/50">
          <div className="relative border-b border-border">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                // Enter takes the top match, so a full name never has to be
                // typed and then clicked.
                if (event.key !== 'Enter') return;
                event.preventDefault();
                const first = results[0];
                if (first) {
                  onChange(first.slug);
                  close();
                }
              }}
              placeholder="Search brawlers"
              aria-label="Search brawlers"
              className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted/70"
            />
          </div>

          <ul role="listbox" aria-label={label} className="max-h-72 overflow-y-auto py-1">
            {results.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-muted">
                No brawler matches “{query}”.
              </li>
            ) : (
              results.map((brawler) => (
                <li key={brawler.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={brawler.slug === value}
                    onClick={() => {
                      onChange(brawler.slug);
                      close();
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm capitalize transition-colors hover:bg-surface-2 ${
                      brawler.slug === value ? 'text-brand' : ''
                    }`}
                  >
                    <span className="flex-1 truncate">{brawler.name.toLowerCase()}</span>
                    {brawler.slug === value ? <Check aria-hidden className="size-4" /> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
