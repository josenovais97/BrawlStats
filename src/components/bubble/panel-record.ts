'use client';

import { useEffect, useState } from 'react';

/** The Ranked season line at the top of the panel. */
export interface PanelSeason {
  number: number;
  /** Exclusive: the day the next season starts. */
  endsOn: string | null;
  trial: { name: string; imageUrl: string }[];
}

/**
 * Wins and losses since the player entered their tag (2026-11-06).
 *
 * The game keeps only the last ~25 battles, so a record "since" anything has
 * to be accumulated: each time the panel opens it reads the battle log and
 * adds the 3v3 results it has not counted yet, newer than the moment the tag
 * first appeared here. Kept in this browser only, like everything else the
 * panel remembers; a different tag starts a new record. Showdown placements
 * are not wins or losses and are left out. Battles played while the panel
 * stays closed for more than ~25 games are missed, which only ever makes the
 * record smaller, never wrong.
 */
export interface SinceTagRecord {
  tag: string;
  /** ISO time the record started. */
  since: string;
  wins: number;
  losses: number;
  /** battleTime keys already counted, newest last, capped. */
  seen: string[];
}

/**
 * Form over the battles the game still holds (~25), shown the moment a tag is
 * in rather than after new games (owner, 2026-11-06): wins and losses in 3v3,
 * how often the player was star player, and the current streak.
 */
export interface RecentForm {
  games: number;
  wins: number;
  losses: number;
  stars: number;
  /** Consecutive results from the newest battle back: +3 is three wins, -2 two losses. */
  streak: number;
  /** Wins and losses per game mode (the API's key, e.g. "gemGrab"), most played first. */
  byMode: { mode: string; wins: number; losses: number }[];
}

const STORED_RECORD = 'brawlzone-bubble-record';
const SEEN_CAP = 200;

function load(): SinceTagRecord | null {
  try {
    const raw = window.localStorage.getItem(STORED_RECORD);
    return raw ? (JSON.parse(raw) as SinceTagRecord) : null;
  } catch {
    return null;
  }
}

function save(record: SinceTagRecord) {
  try {
    window.localStorage.setItem(STORED_RECORD, JSON.stringify(record));
  } catch {
    // Storage blocked: the record lives for this open only.
  }
}

/** The API's "20261106T091200.000Z" as a Date. */
function battleDate(value: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(value);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : NaN;
}

type LogEntry = {
  battleTime: string;
  event?: { mode?: string };
  battle?: { mode?: string; result?: string; starPlayer?: { tag?: string } | null };
};

function formOf(items: LogEntry[], tag: string): RecentForm {
  const own = `#${tag.replace(/^#/, '').toUpperCase()}`;
  const form: RecentForm = { games: 0, wins: 0, losses: 0, stars: 0, streak: 0, byMode: [] };
  const modes = new Map<string, { mode: string; wins: number; losses: number }>();
  let streakOpen = true;
  for (const entry of items) {
    const result = entry.battle?.result;
    if (result !== 'victory' && result !== 'defeat') continue;
    form.games += 1;
    if (result === 'victory') form.wins += 1;
    else form.losses += 1;
    if (entry.battle?.starPlayer?.tag?.toUpperCase() === own) form.stars += 1;
    const mode = entry.event?.mode ?? entry.battle?.mode;
    if (mode) {
      const m = modes.get(mode) ?? { mode, wins: 0, losses: 0 };
      if (result === 'victory') m.wins += 1;
      else m.losses += 1;
      modes.set(mode, m);
    }
    // Newest first: the streak is the run at the top of the log.
    if (streakOpen) {
      const step = result === 'victory' ? 1 : -1;
      if (form.streak === 0 || Math.sign(form.streak) === step) form.streak += step;
      else streakOpen = false;
    }
  }
  form.byMode = [...modes.values()].sort((a, b) => b.wins + b.losses - (a.wins + a.losses));
  return form;
}

export function useSinceTagRecord(tag: string | null): { record: SinceTagRecord | null; form: RecentForm | null } {
  const [record, setRecord] = useState<SinceTagRecord | null>(null);
  const [form, setForm] = useState<{ tag: string; form: RecentForm } | null>(null);

  useEffect(() => {
    if (!tag) return;
    const stored = load();
    const current: SinceTagRecord =
      stored && stored.tag === tag ? stored : { tag, since: new Date().toISOString(), wins: 0, losses: 0, seen: [] };
    if (current !== stored) save(current);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecord(current);

    const controller = new AbortController();
    fetch(`/api/player/${encodeURIComponent(tag)}/battlelog`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((log: { items?: LogEntry[] }) => {
        setForm({ tag, form: formOf(log.items ?? [], tag) });
        const since = Date.parse(current.since);
        const seen = new Set(current.seen);
        let { wins, losses } = current;
        const added: string[] = [];
        for (const entry of [...(log.items ?? [])].reverse()) {
          const result = entry.battle?.result;
          if (result !== 'victory' && result !== 'defeat') continue;
          if (seen.has(entry.battleTime) || !(battleDate(entry.battleTime) >= since)) continue;
          if (result === 'victory') wins += 1;
          else losses += 1;
          added.push(entry.battleTime);
        }
        if (added.length === 0) return;
        const next = { ...current, wins, losses, seen: [...current.seen, ...added].slice(-SEEN_CAP) };
        save(next);
        setRecord(next);
      })
      .catch(() => {
        // An empty log since the November 2026 update is a 404; the record
        // simply does not move.
      });
    return () => controller.abort();
  }, [tag]);

  return {
    record: tag && record?.tag === tag ? record : null,
    form: tag && form?.tag === tag ? form.form : null,
  };
}
