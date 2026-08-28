"use client";

import Link from "next/link";

import {
  ClubIcon,
  CosmeticsIcon,
  PlayersIcon,
  RankedIcon,
} from "@/components/game-icons";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { RegionPicker } from "@/components/leaderboard/region-picker";
import {
  leaderboardHref,
  type LeaderboardBoard,
} from "@/lib/leaderboard-route";

/* Defined with the URL scheme it is a segment of; re-exported so the callers
   that already import it from here keep working. */
export type { LeaderboardBoard };

interface LeaderboardControlsProps {
  region: string;
  board: LeaderboardBoard;
}

// Typed structurally rather than as a lucide icon: ClubIcon is one of our own
// SVG components, not a lucide forwardRef, and the two only agree on this.
const BOARDS: {
  key: LeaderboardBoard;
  icon: (props: { className?: string }) => React.ReactNode;
}[] = [
  { key: "players", icon: PlayersIcon },
  { key: "clubs", icon: ClubIcon },
  { key: "ranked", icon: RankedIcon },
  { key: "cosmetics", icon: CosmeticsIcon },
];

/**
 * Drives the leaderboard purely through the URL, so the server component above
 * re-renders with fresh data and every view is linkable.
 */
export function LeaderboardControls({
  region,
  board,
}: LeaderboardControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Paths, not a query string: the board is what makes this page cacheable,
  // and `?type=` is what stopped it being. `leaderboardHref` drops the region
  // for the boards that have none, so switching to one cannot leave a segment
  // behind that names nothing.
  function navigate(next: { region?: string; type?: LeaderboardBoard }) {
    const target = leaderboardHref(next.type ?? board, next.region ?? region);
    startTransition(() => {
      router.push(target);
    });
  }

  return (
    <div
      className={`card relative z-30 flex flex-col gap-4 p-4 transition-opacity sm:flex-row sm:items-center ${
        pending ? "opacity-60" : ""
      }`}
    >
      <div className="flex gap-2">
        {BOARDS.map(({ key, icon: Icon }) => (
          /*
            A real link that behaves like a tab. As a <button> these were the
            only route to the board pages, so the served HTML contained zero
            /leaderboard/<board> links and every board except the default was
            orphaned -- taking the 100 ranked players it lists with it, which
            is the whole set the crawler is allowed to index.

            The handler keeps the client-side transition, and bails on modified
            clicks so ctrl/cmd/middle-click still open a board in a new tab.
          */
          <Link
            key={key}
            href={leaderboardHref(key, region)}
            onClick={(event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              navigate({ type: key });
            }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${
              board === key
                ? "bg-brand text-[#1a1200]"
                : "border border-border text-muted hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {key}
          </Link>
        ))}
      </div>

      {/* Hidden on the two boards built from our own sampled pool: neither has
          a region dimension, so the picker would be a control that changes
          nothing. */}
      {board === "cosmetics" || board === "ranked" ? null : (
        <div className="flex flex-1 sm:justify-end">
          <RegionPicker
            value={region}
            onChange={(code) => navigate({ region: code })}
            disabled={pending}
          />
        </div>
      )}
    </div>
  );
}
