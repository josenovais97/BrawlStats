'use client';

import { Shield, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { RegionPicker } from '@/components/leaderboard/region-picker';

interface LeaderboardControlsProps {
  region: string;
  board: 'players' | 'clubs';
}

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
        {(['players', 'clubs'] as const).map((type) => {
          const Icon = type === 'players' ? User : Shield;
          return (
            <button
              key={type}
              type="button"
              onClick={() => navigate({ type })}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${
                board === type
                  ? 'bg-brand text-[#1a1200]'
                  : 'border border-border text-muted hover:text-foreground'
              }`}
            >
              <Icon className="size-4" />
              {type}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 sm:justify-end">
        <RegionPicker
          value={region}
          onChange={(code) => navigate({ region: code })}
          disabled={pending}
        />
      </div>
    </div>
  );
}
