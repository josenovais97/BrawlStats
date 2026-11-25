'use client';

import { useEffect, useState } from 'react';

/** One rank's bans, as `/api/bubble/bans/<rank>` returns them. */
export interface RankBans {
  battles: number;
  /** True when the rank had too few games and a wider set answers. */
  wide: boolean;
  /** [brawler, share of games it is banned in], most banned first. */
  all: [number, number][];
  /** By map name. */
  maps: Record<string, { wide: boolean; bans: [number, number][] }>;
}

/* One request per rank for the life of the page, shared by the tabs. */
const loads = new Map<string, Promise<RankBans>>();

function load(rank: string): Promise<RankBans> {
  let got = loads.get(rank);
  if (!got) {
    got = fetch(`/api/bubble/bans/${rank}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: RankBans) => d);
    got.catch(() => loads.delete(rank));
    loads.set(rank, got);
  }
  return got;
}

/** The bans at a rank (null = every rank); null until they are in, or unknown. */
export function useBans(rank: string | null): RankBans | null {
  const key = rank ?? 'all';
  const [state, setState] = useState<{ key: string; data: RankBans } | null>(null);
  useEffect(() => {
    let on = true;
    load(key)
      .then((data) => {
        if (on) setState({ key, data });
      })
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, [key]);
  return state?.key === key ? state.data : null;
}
