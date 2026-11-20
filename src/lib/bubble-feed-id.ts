/**
 * Post ids of the Bubble app's squad feed (1.42), checked by the reactions
 * endpoint. The posts themselves are made on each phone from public game data
 * (rank-ups, streaks, the weekly duel, squad awards); an id is built from the
 * facts behind a post, so two friends' phones name the same post the same way
 * and see each other's reactions.
 *
 * `kind.SUBJECT[.part...]`: the second part is always the tag the post is
 * about, and a `pass` post names the player who was passed third. Parts are
 * short and plain so an id can never carry text anyone typed.
 */

export const FEED_KINDS = ['rank', 'pass', 'streak', 'tilt', 'session', 'duel', 'lead', 'mvp', 'awards'] as const;
export const REACTIONS = ['fire', 'lol', 'crown', 'wow', 'dead', 'clap'] as const;
export type FeedReaction = (typeof REACTIONS)[number];

const TAG = /^[0289PYLQGRJCUV]{3,12}$/;
const PART = /^[0-9A-Za-z]{1,16}$/;

export interface FeedPostId {
  kind: (typeof FEED_KINDS)[number];
  /** Every player tag the post names: the subject first. */
  tags: string[];
}

export function parsePostId(id: unknown): FeedPostId | null {
  if (typeof id !== 'string' || id.length > 80) return null;
  const parts = id.split('.');
  if (parts.length < 2 || parts.length > 5) return null;
  const [kind, subject, ...rest] = parts;
  if (!(FEED_KINDS as readonly string[]).includes(kind) || !TAG.test(subject) || !rest.every((p) => PART.test(p))) return null;
  const tags = [subject];
  if (kind === 'pass') {
    if (!rest[0] || !TAG.test(rest[0])) return null;
    tags.push(rest[0]);
  }
  return { kind: kind as FeedPostId['kind'], tags };
}

export function isReaction(value: unknown): value is FeedReaction {
  return typeof value === 'string' && (REACTIONS as readonly string[]).includes(value);
}
