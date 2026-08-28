"use client";

import { X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { ClubIcon, PlayersIcon } from "@/components/game-icons";
import { playerIconUrl } from "@/lib/brawlapi";
import {
  clearRecentSearches,
  readRecentSearches,
  serverRecentSearches,
  subscribeRecentSearches,
} from "@/lib/recent-searches";

/**
 * Tags looked up on this device, as a one-line shortcut rather than a section.
 *
 * It used to be a labelled block inside the hero's search card — heading,
 * wrapped chips, a clear-all — which made the card tall enough to push the
 * metrics strip off a laptop screen. The information is a shortcut, not a
 * feature, so it now reads as one: a short row you either recognise and tap or
 * ignore entirely.
 *
 * Renders nothing until mounted, so the server HTML and the first client
 * render agree — localStorage does not exist during SSR.
 */

/** Two fit a 320px row beside the label; three is the most that stays scannable. */
const SHOWN = 3;

export function RecentSearches() {
  const entries = useSyncExternalStore(
    subscribeRecentSearches,
    readRecentSearches,
    serverRecentSearches,
  );

  if (entries.length === 0) return null;
  const shown = entries.slice(0, SHOWN);

  return (
    <div className="mt-3 flex items-center gap-2.5 border-t border-border pt-3">
      <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-wide text-muted sm:inline">
        Continue with
      </span>

      {/* Scrolls rather than wraps: a second row here is the height this was
          meant to remove. The negative margin lets chips run to the card edge
          instead of stopping short of it. */}
      <ul className="-mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 py-0.5">
        {shown.map((entry) => {
          const isClub = entry.kind === "club";
          return (
            <li key={`${entry.kind}:${entry.tag}`} className="shrink-0">
              <Link
                href={`/${entry.kind}/${entry.tag}`}
                className="flex min-h-9 items-center gap-2 rounded-lg border border-border bg-surface-2/60 py-1 pl-1 pr-2.5 text-sm transition-colors hover:border-brand/50"
              >
                {entry.icon && !isClub ? (
                  <Image
                    src={playerIconUrl(entry.icon)}
                    alt=""
                    width={24}
                    height={24}
                    className="size-6 shrink-0 rounded bg-surface-2"
                    loading="lazy"
                    unoptimized
                  />
                ) : (
                  <span className="grid size-6 shrink-0 place-items-center rounded bg-surface-2">
                    {isClub ? (
                      <ClubIcon className="size-3.5" />
                    ) : (
                      <PlayersIcon className="size-3.5" />
                    )}
                  </span>
                )}
                <span className="max-w-[7rem] truncate font-medium">
                  {entry.name || `#${entry.tag}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={clearRecentSearches}
        aria-label="Clear recent profiles"
        title="Clear recent profiles"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
