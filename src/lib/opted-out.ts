import { createHash } from 'node:crypto';

import { normalizeTag } from '@/lib/tags';

/**
 * Players who asked to be removed (2026-10-26): their profile is not shown,
 * they are left out of club pages and leaderboards, and they are never
 * sampled or recorded again. The privacy page promises this on request.
 *
 * Kept as hashes, not tags: a list of the people who asked to be forgotten
 * should not itself be a list of their identifiers. Tags are normalised first
 * (the same `normalizeTag` every route uses), so "#pv28..." and "PV28..."
 * hash alike.
 *
 * To add one: `printf 'brawlzone-opt-out:%s' TAG | sha256sum` with the tag in
 * capitals and no '#', and a line here with the date of the request. Then
 * delete what is stored for it: sampled_players.tag and every player_tag
 * column (snapshots, battles, trophy points, rankings, club snapshots,
 * Discord links). Never write the tag itself in the repo, tests included.
 */
const OPTED_OUT = new Set<string>([
  // 2026-10-26, by email.
  '80de15981aceaac0760ac209d01ba7f897d5b152fbe80442481d48f73dd12622',
]);

/** The hash a tag is listed under, after normalising; '' for no tag. */
export function optOutHash(tag: string | null | undefined): string {
  const t = normalizeTag(tag);
  return t ? createHash('sha256').update(`brawlzone-opt-out:${t}`).digest('hex') : '';
}

export function isOptedOut(tag: string | null | undefined, list: ReadonlySet<string> = OPTED_OUT): boolean {
  const h = optOutHash(tag);
  return h !== '' && list.has(h);
}
