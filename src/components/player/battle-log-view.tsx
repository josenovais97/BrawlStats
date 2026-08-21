'use client';

import { ChevronDown, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { CrownIcon, TrophyIcon } from '@/components/game-icons';
import { formatNumber } from '@/lib/format';
import { normalizeTag } from '@/lib/tags';

export type BattleTone = 'win' | 'loss' | 'draw';

export interface BattleParticipant {
  tag: string;
  name: string;
  brawlerName: string | null;
  brawlerPower: number | null;
  brawlerTrophies: number | null;
  iconUrl: string | null;
  isStar: boolean;
  isSelf: boolean;
}

export interface BattleEntry {
  key: string;
  outcomeLabel: string;
  tone: BattleTone;
  mode: string;
  map: string;
  type: string;
  relative: string;
  trophyChange: number | null;
  brawlerName: string | null;
  iconUrl: string | null;
  isStarPlayer: boolean;
  teams: BattleParticipant[][];
  isTeamMode: boolean;
}

const TONE_COLOR: Record<BattleTone, string> = {
  win: 'var(--victory)',
  loss: 'var(--defeat)',
  draw: 'var(--draw)',
};

/**
 * The battle log, as a session rather than a list.
 *
 * The API returns about twenty-five battles and a real session is usually the
 * same map over and over: eight rows reading "Victory · Wipeout · Slippery
 * road · Ranked · +6", identical but for nothing at all. That is genuinely what
 * was played, but presenting it as twenty-five unrelated events buried the one
 * thing the log is for — the shape of how it went — and made this the single
 * biggest contributor to a ten-thousand-pixel page.
 *
 * So consecutive battles that share a result, a mode, a map and a type collapse
 * into one row that says how many and what they were worth together, and open
 * to the individual matches. A run is the unit a player actually remembers.
 *
 * The form strip above does the other half: twenty-five results as twenty-five
 * marks, which answers "how is it going" before any row is read.
 *
 * Filters are client state, which is why this is a client component at all. The
 * rows keep using native `<details>` — a disclosure per battle should never
 * cost a hydration boundary of its own.
 */
export function BattleLogView({ entries }: { entries: BattleEntry[] }) {
  const [tone, setTone] = useState<BattleTone | 'all'>('all');
  const [mode, setMode] = useState('all');

  const modes = useMemo(
    () => [...new Set(entries.map((entry) => entry.mode))].sort(),
    [entries],
  );

  const tones = useMemo(
    () =>
      (['win', 'loss', 'draw'] as const).filter((t) =>
        entries.some((entry) => entry.tone === t),
      ),
    [entries],
  );

  const filtered = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (tone === 'all' || entry.tone === tone) &&
          (mode === 'all' || entry.mode === mode),
      ),
    [entries, mode, tone],
  );

  /*
   * Runs are built after filtering, not before. Filtering to losses should
   * group the losses that were consecutive *among the losses shown*, or the
   * list reads as though battles are missing from the middle of a run.
   */
  const runs = useMemo(() => {
    const out: BattleEntry[][] = [];
    for (const entry of filtered) {
      const last = out[out.length - 1];
      const head = last?.[0];
      const same =
        head &&
        head.outcomeLabel === entry.outcomeLabel &&
        head.mode === entry.mode &&
        head.map === entry.map &&
        head.type === entry.type;
      if (same) last.push(entry);
      else out.push([entry]);
    }
    return out;
  }, [filtered]);

  const record = useMemo(() => {
    const wins = entries.filter((e) => e.tone === 'win').length;
    const losses = entries.filter((e) => e.tone === 'loss').length;
    return { wins, losses };
  }, [entries]);

  return (
    <div className="space-y-4">
      {/* Form: the whole log in one line, newest on the left. */}
      <div className="card flex flex-wrap items-center gap-x-4 gap-y-3 p-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {entries.map((entry) => (
            <span
              key={entry.key}
              title={`${entry.outcomeLabel} · ${entry.mode} · ${entry.map}`}
              className="h-5 min-w-1.5 flex-1 rounded-full"
              style={{ background: TONE_COLOR[entry.tone] }}
            />
          ))}
        </div>
        <p className="shrink-0 text-xs text-muted">
          <span className="font-bold tabular-nums text-victory">{record.wins}W</span>
          {' · '}
          <span className="font-bold tabular-nums text-defeat">{record.losses}L</span>
          {' over the last '}
          <span className="tabular-nums">{entries.length}</span>
        </p>
      </div>

      {(tones.length > 1 || modes.length > 1) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tones.length > 1 ? (
            <div role="group" aria-label="Filter by result" className="flex gap-1.5">
              <Chip active={tone === 'all'} onClick={() => setTone('all')}>
                All results
              </Chip>
              {tones.map((t) => (
                <Chip
                  key={t}
                  active={tone === t}
                  onClick={() => setTone(t)}
                  dot={TONE_COLOR[t]}
                >
                  {t === 'win' ? 'Wins' : t === 'loss' ? 'Losses' : 'Draws'}
                </Chip>
              ))}
            </div>
          ) : null}

          {modes.length > 1 ? (
            <div
              role="group"
              aria-label="Filter by mode"
              className="flex flex-wrap gap-1.5"
            >
              <Chip active={mode === 'all'} onClick={() => setMode('all')}>
                All modes
              </Chip>
              {modes.map((m) => (
                <Chip key={m} active={mode === m} onClick={() => setMode(m)}>
                  {m}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {runs.length === 0 ? (
        <p className="card p-6 text-sm text-muted">
          No battles match that filter.
        </p>
      ) : (
        <ol className="space-y-2">
          {runs.map((run) => (
            <li key={run[0].key}>
              {run.length === 1 ? (
                <BattleRow entry={run[0]} />
              ) : (
                <RunRow run={run} />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  dot,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
        active
          ? 'bg-brand text-brand-ink'
          : 'border border-border bg-surface-2/60 text-muted hover:border-border-strong hover:text-foreground'
      }`}
    >
      {dot && !active ? (
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ background: dot }}
        />
      ) : null}
      {children}
    </button>
  );
}

/** A run of identical consecutive battles, summed. */
function RunRow({ run }: { run: BattleEntry[] }) {
  const head = run[0];
  const total = run.reduce((sum, entry) => sum + (entry.trophyChange ?? 0), 0);
  const stars = run.filter((entry) => entry.isStarPlayer).length;

  return (
    <details
      className="card group overflow-hidden"
      style={{ borderLeft: `3px solid ${TONE_COLOR[head.tone]}` }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 transition-colors hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
        <BrawlerTile iconUrl={head.iconUrl} name={head.brawlerName} count={run.length} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold" style={{ color: TONE_COLOR[head.tone] }}>
              {head.outcomeLabel}
            </span>
            <span className="text-xs font-bold tabular-nums text-muted">
              ×{run.length}
            </span>
            <span className="text-muted">·</span>
            <span className="truncate text-sm font-medium">{head.mode}</span>
            {stars > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">
                <CrownIcon className="size-3.5" />
                Star player ×{stars}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">
            {head.map} · {head.type} · {run[run.length - 1].relative}
          </p>
        </div>

        <TrophyDelta value={total} />
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
        />
      </summary>

      <ol className="space-y-2 border-t border-border bg-surface-2/20 p-2 sm:p-3">
        {run.map((entry) => (
          <li key={entry.key}>
            <BattleRow entry={entry} nested />
          </li>
        ))}
      </ol>
    </details>
  );
}

function BattleRow({ entry, nested = false }: { entry: BattleEntry; nested?: boolean }) {
  return (
    <details
      className={`group overflow-hidden ${nested ? 'rounded-xl bg-surface' : 'card'}`}
      style={{ borderLeft: `3px solid ${TONE_COLOR[entry.tone]}` }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 transition-colors hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
        <BrawlerTile iconUrl={entry.iconUrl} name={entry.brawlerName} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold" style={{ color: TONE_COLOR[entry.tone] }}>
              {entry.outcomeLabel}
            </span>
            <span className="text-muted">·</span>
            <span className="truncate text-sm font-medium">{entry.mode}</span>
            {entry.isStarPlayer ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">
                <CrownIcon className="size-3.5" />
                Star player
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">
            {entry.map} · {entry.type} · {entry.relative}
          </p>
        </div>

        <TrophyDelta value={entry.trophyChange} />
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
        />
      </summary>

      {entry.teams.length > 0 ? (
        <Lineup teams={entry.teams} isTeamMode={entry.isTeamMode} />
      ) : (
        <p className="border-t border-border px-4 py-3 text-xs text-muted">
          This battle reported no player list.
        </p>
      )}
    </details>
  );
}

function BrawlerTile({
  iconUrl,
  name,
  count,
}: {
  iconUrl: string | null;
  name: string | null;
  count?: number;
}) {
  return (
    <span className="relative shrink-0">
      {iconUrl ? (
        <Image
          src={iconUrl}
          alt={name ?? ''}
          width={48}
          height={48}
          className="size-12 rounded-lg bg-surface-2"
          unoptimized
        />
      ) : (
        <span className="block size-12 rounded-lg bg-surface-2" />
      )}
      {count && count > 1 ? (
        <span className="absolute -bottom-1 -right-1 grid min-w-5 place-items-center rounded-full border border-border bg-surface px-1 text-[0.625rem] font-bold tabular-nums">
          {count}
        </span>
      ) : null}
    </span>
  );
}

function TrophyDelta({ value }: { value: number | null }) {
  if (typeof value !== 'number' || value === 0) {
    return <Minus aria-hidden className="size-4 shrink-0 text-muted/50" />;
  }
  return (
    <span
      className={`flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums ${
        value > 0 ? 'text-victory' : 'text-defeat'
      }`}
    >
      {value > 0 ? (
        <TrendingUp aria-hidden className="size-4" />
      ) : (
        <TrendingDown aria-hidden className="size-4" />
      )}
      {value > 0 ? `+${value}` : value}
    </span>
  );
}

/**
 * Every participant, grouped by team.
 *
 * Showdown payloads arrive as a flat list rather than teams, so those come
 * through as a single pseudo-team and render without the "Team 1 / Team 2"
 * headings that would be meaningless there.
 */
function Lineup({
  teams,
  isTeamMode,
}: {
  teams: BattleParticipant[][];
  isTeamMode: boolean;
}) {
  return (
    <div className="border-t border-border bg-surface-2/30 p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {teams.map((team, teamIndex) => (
          <div key={teamIndex}>
            {isTeamMode && teams.length > 1 ? (
              <p className="eyebrow mb-2">Team {teamIndex + 1}</p>
            ) : null}
            <ul className="space-y-1">
              {team.map((participant) => (
                <li key={participant.tag}>
                  <Link
                    href={`/player/${normalizeTag(participant.tag)}`}
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-3 ${
                      participant.isSelf
                        ? 'bg-brand/10 ring-1 ring-inset ring-brand/25'
                        : ''
                    }`}
                  >
                    {participant.iconUrl ? (
                      <Image
                        src={participant.iconUrl}
                        alt={participant.brawlerName ?? ''}
                        width={32}
                        height={32}
                        className="size-8 shrink-0 rounded-md bg-surface-2"
                        loading="lazy"
                        unoptimized
                      />
                    ) : (
                      <span className="size-8 shrink-0 rounded-md bg-surface-2" />
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`truncate text-sm ${
                            participant.isSelf ? 'font-bold text-brand' : 'font-medium'
                          }`}
                        >
                          {participant.name}
                        </span>
                        {participant.isStar ? (
                          <CrownIcon className="size-3.5 shrink-0" />
                        ) : null}
                      </span>
                      <span className="block truncate text-xs capitalize text-muted">
                        {participant.brawlerName
                          ? participant.brawlerName.toLowerCase()
                          : 'Unknown brawler'}
                        {participant.brawlerPower
                          ? ` · power ${participant.brawlerPower}`
                          : ''}
                      </span>
                    </span>

                    {participant.brawlerTrophies !== null ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-muted">
                        <TrophyIcon className="size-3" />
                        {formatNumber(participant.brawlerTrophies)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
