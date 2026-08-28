"use client";

import { Check, ChevronDown, Globe, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  POPULAR_REGION_CODES,
  REGION_OPTIONS,
  regionName,
} from "@/lib/regions";

interface RegionPickerProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

/**
 * Searchable region combobox. A native <select> with ~250 entries is
 * technically usable but miserable to navigate, so this filters as you type
 * and keeps the high-traffic regions pinned to the top.
 */
export function RegionPicker({ value, onChange, disabled }: RegionPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Focus only — the query is reset by whoever closes the panel, so state is
  // never set from inside an effect.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return REGION_OPTIONS;
    return REGION_OPTIONS.filter(
      (r) => r.name.toLowerCase().includes(q) || r.code === q,
    );
  }, [query]);

  const popularCount = POPULAR_REGION_CODES.length + 1;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm transition-colors hover:border-brand/50 disabled:opacity-60 sm:w-56"
      >
        <Globe className="size-4 shrink-0 text-muted" />
        <span className="flex-1 truncate text-left">{regionName(value)}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-full min-w-[16rem] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/50 sm:w-72">
          <div className="relative border-b border-border">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries"
              aria-label="Search countries"
              className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted/85"
            />
          </div>

          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {results.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-muted">
                No country matches “{query}”.
              </li>
            ) : (
              results.map((region, index) => (
                <li key={region.code}>
                  {!query && index === popularCount ? (
                    <p className="border-t border-border px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      All countries
                    </p>
                  ) : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={region.code === value}
                    onClick={() => {
                      onChange(region.code);
                      close();
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 ${
                      region.code === value ? "text-brand" : ""
                    }`}
                  >
                    <span className="flex-1 truncate">{region.name}</span>
                    <span className="font-mono text-xs uppercase text-muted">
                      {region.code}
                    </span>
                    {region.code === value ? (
                      <Check className="size-4" />
                    ) : null}
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
