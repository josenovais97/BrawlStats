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

export function useSinceTagRecord(tag: string | null): SinceTagRecord | null {
  const [record, setRecord] = useState<SinceTagRecord | null>(null);

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
      .then((log: { items?: { battleTime: string; battle?: { result?: string } }[] }) => {
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

  return tag && record?.tag === tag ? record : null;
}
