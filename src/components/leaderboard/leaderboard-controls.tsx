'use client';

import { Globe, Shield, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { FEATURED_REGIONS } from '@/lib/regions';

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
      className={`card flex flex-col gap-4 p-4 transition-opacity sm:flex-row sm:items-center ${
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

      <label className="flex flex-1 items-center gap-2 sm:justify-end">
        <Globe className="size-4 shrink-0 text-muted" />
        <span className="sr-only">Region</span>
        <select
          value={region}
          onChange={(e) => navigate({ region: e.target.value })}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none transition-colors focus:border-brand/60"
        >
          {FEATURED_REGIONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
