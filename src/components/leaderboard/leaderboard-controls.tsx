'use client';

import { Shirt, User } from 'lucide-react';

import { ClubIcon } from '@/components/game-icons';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { RegionPicker } from '@/components/leaderboard/region-picker';

export type LeaderboardBoard = 'players' | 'clubs' | 'cosmetics';

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
  { key: 'players', icon: User },
  { key: 'clubs', icon: ClubIcon },
  { key: 'cosmetics', icon: Shirt },
];

/**
 * Drives the leaderboard purely through the URL, so the server component above
 * re-renders with fresh data and every view is linkable.
 */
export function LeaderboardControls({ region, board }: LeaderboardControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(next: { region?: string; type?: string }) {
    const params = new URLSearchParams({
      region: next.region ?? region,
      type: next.type ?? board,
    });
    startTransition(() => {
      router.push(`/leaderboard?${params.toString()}`);
    });
  }

  return (
    <div
      className={`card relative z-30 flex flex-col gap-4 p-4 transition-opacity sm:flex-row sm:items-center ${
        pending ? 'opacity-60' : ''
      }`}
    >
      <div className="flex gap-2">
        {BOARDS.map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate({ type: key })}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${
              board === key
                ? 'bg-brand text-[#1a1200]'
                : 'border border-border text-muted hover:text-foreground'
            }`}
          >
            <Icon className="size-4" />
            {key}
          </button>
        ))}
      </div>

      {/* Hidden on the cosmetics board: it is built from our own sampled pool,
          which has no region dimension, so the picker would be a control that
          changes nothing. */}
      {board === 'cosmetics' ? null : (
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
