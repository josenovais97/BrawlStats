'use client';

import { ChevronDown, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { CrownIcon, TrophyIcon } from '@/components/game-icons';
import { formatNumber } from '@/lib/format';
import { normalizeTag } from '@/lib/tags';
import { playerLinkRel } from '@/lib/link-rel';

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
  /**
   * The game's own mode art, resolved on the server.
   *
   * A battle history without mode icons is a list of sentences. The brawler
   * portrait was already here; the mode was the word "Knockout" and nothing
   * else, which is the one thing a Brawl Stars player identifies by shape
   * before they read it.
   */
  modeIconUrl: string | null;
  map: string;
  type: string;
  relative: string;
  trophyChange: number | null;
  brawlerName: string | null;
  brawlerId: number | null;
  iconUrl: string | null;
  /** The brawler in the skin this account has equipped, when it could be resolved. */
  artUrl: string | null;
  /** The brawler's rarity colour. */
  tint: string | null;
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

  const modes = useMemo(() => [...new Set(entries.map((entry) => entry.mode))].sort(), [entries]);

  const tones = useMemo(
    () =>
      (['win', 'loss', 'draw'] as const).filter((t) => entries.some((entry) => entry.tone === t)),
    [entries],
  );

  const filtered = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (tone === 'all' || entry.tone === tone) && (mode === 'all' || entry.mode === mode),
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

  return (
    <div className="space-y-4">
      <Session entries={entries} />

      {(tones.length > 1 || modes.length > 1) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tones.length > 1 ? (
            <div role="group" aria-label="Filter by result" className="flex gap-1.5">
              <Chip active={tone === 'all'} onClick={() => setTone('all')}>
                All results
              </Chip>
              {tones.map((t) => (
                <Chip key={t} active={tone === t} onClick={() => setTone(t)} dot={TONE_COLOR[t]}>
                  {t === 'win' ? 'Wins' : t === 'loss' ? 'Losses' : 'Draws'}
                </Chip>
              ))}
            </div>
          ) : null}

          {modes.length > 1 ? (
            <div role="group" aria-label="Filter by mode" className="flex flex-wrap gap-1.5">
              <Chip active={mode === 'all'} onClick={() => setMode('all')}>
                All modes
              </Chip>
              {modes.map((m) => {
                const icon = entries.find((e) => e.mode === m && e.modeIconUrl)?.modeIconUrl;
                return (
                  <Chip key={m} active={mode === m} onClick={() => setMode(m)}>
                    {icon ? (
                      <Image
                        src={icon}
                        alt=""
                        width={16}
                        height={16}
                        className="size-4 shrink-0 object-contain"
                        unoptimized
                      />
                    ) : null}
                    {m}
                  </Chip>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {runs.length === 0 ? (
        <p className="card p-6 text-sm text-muted">No battles match that filter.</p>
      ) : (
        <ol className="space-y-2">
          {runs.map((run) => (
            <li key={run[0].key}>
              {run.length === 1 ? <BattleRow entry={run[0]} /> : <RunRow run={run} />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * The session at a glance, before a single row.
 *
 * The log is about twenty-five games, which is one or two sittings, and the
 * questions a player brings to it are about that sitting: how did it go, what
 * was I playing, what was working. The headline is the record and what it was
 * worth; the most-played brawler stands beside it in the skin actually
 * equipped, as the rest of the profile draws it; the form strip keeps its
 * place underneath; and two short breakdowns -- by mode and by brawler --
 * answer "what was working" without the reader tallying rows.
 */
function Session({ entries }: { entries: BattleEntry[] }) {
  const s = useMemo(() => summarise(entries), [entries]);
  const main = s.brawlers[0];
  const tint = main?.tint ?? 'var(--brand)';

  return (
    <section className="card overflow-hidden">
      <div
        className="relative flex flex-wrap items-stretch gap-x-5 gap-y-2 px-4 pt-4 sm:px-5"
        style={{
          background: `linear-gradient(120deg, color-mix(in srgb, ${tint} 22%, transparent), transparent 60%)`,
        }}
      >
        {main?.art ? (
          <div className="relative flex w-24 shrink-0 items-end justify-center sm:w-28">
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-1/2 size-24 -translate-x-1/2 rounded-full opacity-40 blur-2xl"
              style={{ background: tint }}
            />
            <Image
              src={main.art}
              alt=""
              width={112}
              height={112}
              className="relative h-24 w-auto object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)] sm:h-28"
              unoptimized
            />
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 basis-48 flex-col justify-center pb-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Last {entries.length} games
            {main ? (
              <span className="normal-case tracking-normal">
                {' '}
                · mostly <span className="font-bold capitalize text-foreground">{main.name.toLowerCase()}</span>
              </span>
            ) : null}
          </p>
          <p className="display mt-1 text-3xl leading-none tabular-nums sm:text-4xl">
            <span className="text-victory">{s.wins}W</span>
            <span className="text-muted"> · </span>
            <span className="text-defeat">{s.losses}L</span>
            {s.draws > 0 ? (
              <>
                <span className="text-muted"> · </span>
                <span className="text-draw">{s.draws}D</span>
              </>
            ) : null}
          </p>
        </div>

        <dl className="flex shrink-0 items-center gap-5 pb-4 max-sm:w-full max-sm:justify-between">
          <Stat label="Win rate" value={s.decided ? `${Math.round((s.wins / s.decided) * 100)}%` : '—'} />
          {s.trophies !== null ? (
            <Stat
              label="Trophies"
              value={`${s.trophies > 0 ? '+' : s.trophies < 0 ? '−' : ''}${formatNumber(Math.abs(s.trophies))}`}
              tone={s.trophies > 0 ? 'text-victory' : s.trophies < 0 ? 'text-defeat' : undefined}
            />
          ) : null}
          <Stat label="Star player" value={`×${s.stars}`} tone={s.stars ? 'text-brand' : undefined} />
        </dl>
      </div>

      {/* Form: the whole log in one line, newest on the left. */}
      <div className="flex items-center gap-1 border-t border-border/70 px-4 py-3 sm:px-5">
        {entries.map((entry) => (
          <span
            key={entry.key}
            title={`${entry.outcomeLabel} · ${entry.mode} · ${entry.map}`}
            className="h-4 min-w-1.5 flex-1 rounded-full"
            style={{ background: TONE_COLOR[entry.tone] }}
          />
        ))}
      </div>

      <div className="grid gap-x-6 gap-y-4 border-t border-border/70 px-4 py-4 sm:px-5 md:grid-cols-2">
        <Breakdown title="By mode" rows={s.modes} />
        <Breakdown title="By brawler" rows={s.brawlers} round />
      </div>
    </section>
  );
}

interface Tally {
  key: string;
  name: string;
  /** Mode icon or brawler portrait, for the row. */
  icon: string | null;
  /** The brawler in its equipped skin, for the headline; brawler rows only. */
  art?: string | null;
  tint?: string | null;
  wins: number;
  losses: number;
  games: number;
}

function summarise(entries: BattleEntry[]) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let stars = 0;
  let trophies: number | null = null;
  const modes = new Map<string, Tally>();
  const brawlers = new Map<string, Tally>();

  const bump = (map: Map<string, Tally>, key: string, seed: Omit<Tally, 'wins' | 'losses' | 'games'>, e: BattleEntry) => {
    const t = map.get(key) ?? { ...seed, wins: 0, losses: 0, games: 0 };
    t.games += 1;
    if (e.tone === 'win') t.wins += 1;
    if (e.tone === 'loss') t.losses += 1;
    map.set(key, t);
  };

  for (const e of entries) {
    if (e.tone === 'win') wins += 1;
    else if (e.tone === 'loss') losses += 1;
    else draws += 1;
    if (e.isStarPlayer) stars += 1;
    if (e.trophyChange !== null) trophies = (trophies ?? 0) + e.trophyChange;
    bump(modes, e.mode, { key: e.mode, name: e.mode, icon: e.modeIconUrl }, e);
    if (e.brawlerName) {
      bump(
        brawlers,
        e.brawlerName,
        { key: e.brawlerName, name: e.brawlerName, icon: e.iconUrl, art: e.artUrl, tint: e.tint },
        e,
      );
    }
  }

  // Most played first; the record breaks ties, so the list leads with what
  // the session was actually about.
  const order = (a: Tally, b: Tally) => b.games - a.games || b.wins - a.wins;
  return {
    wins,
    losses,
    draws,
    decided: wins + losses,
    stars,
    trophies,
    modes: [...modes.values()].sort(order),
    brawlers: [...brawlers.values()].sort(order),
  };
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="text-right">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className={`text-xl font-black tabular-nums leading-tight ${tone ?? ''}`}>{value}</dd>
    </div>
  );
}

/** At most this many rows per breakdown; the log below has the rest. */
const BREAKDOWN_ROWS = 4;

function Breakdown({ title, rows, round = false }: { title: string; rows: Tally[]; round?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</p>
      <ul className="space-y-2">
        {rows.slice(0, BREAKDOWN_ROWS).map((r) => {
          const decided = r.wins + r.losses;
          const rate = decided ? r.wins / decided : 0;
          return (
            <li key={r.key} className="flex items-center gap-2.5">
              {r.icon ? (
                <Image
                  src={r.icon}
                  alt=""
                  width={28}
                  height={28}
                  className={`size-7 shrink-0 object-contain ${round ? 'rounded-lg bg-surface-2' : ''}`}
                  loading="lazy"
                  unoptimized
                />
              ) : (
                <span className="size-7 shrink-0 rounded-lg bg-surface-2" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-semibold capitalize">{r.name.toLowerCase()}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    <span className="font-bold text-victory">{r.wins}</span>
                    {' – '}
                    <span className="font-bold text-defeat">{r.losses}</span>
                  </span>
                </div>
                {/* Win share of decided games, so draws neither help nor hurt. */}
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-defeat/30">
                  <div
                    className="h-full rounded-full bg-victory"
                    style={{ width: `${Math.round(rate * 100)}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
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
        <span aria-hidden className="size-1.5 rounded-full" style={{ background: dot }} />
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
            <span className="text-xs font-bold tabular-nums text-muted">×{run.length}</span>
            <span className="text-muted">·</span>
            <ModeMark entry={head} />
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
            <ModeMark entry={entry} />
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
        <span className="absolute -bottom-1 -right-1 grid min-w-5 place-items-center rounded-full border border-border bg-surface px-1 text-xs font-bold tabular-nums">
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
function Lineup({ teams, isTeamMode }: { teams: BattleParticipant[][]; isTeamMode: boolean }) {
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
                    rel={playerLinkRel(normalizeTag(participant.tag))}
                    prefetch={false}
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-3 ${
                      participant.isSelf ? 'bg-brand/10 ring-1 ring-inset ring-brand/25' : ''
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
                        {participant.isStar ? <CrownIcon className="size-3.5 shrink-0" /> : null}
                      </span>
                      <span className="block truncate text-xs capitalize text-muted">
                        {participant.brawlerName
                          ? participant.brawlerName.toLowerCase()
                          : 'Unknown brawler'}
                        {participant.brawlerPower ? ` · power ${participant.brawlerPower}` : ''}
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

/** The mode's own icon, when the catalogue had one for it. */
function ModeMark({ entry }: { entry: BattleEntry }) {
  if (!entry.modeIconUrl) return null;
  return (
    <Image
      src={entry.modeIconUrl}
      alt=""
      width={16}
      height={16}
      className="size-4 shrink-0 object-contain"
      loading="lazy"
      unoptimized
    />
  );
}
