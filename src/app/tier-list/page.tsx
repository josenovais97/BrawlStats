import { redirect } from 'next/navigation';

/**
 * The old single tier list, now split in two.
 *
 * Kept as a redirect rather than deleted: it is the most-linked URL on the
 * site and the one people have bookmarked. Ranked is the default because it is
 * the list that answers "what is actually strong" — the ladder list measures a
 * looser game.
 *
 * Temporary rather than permanent (308), so this can become a landing page
 * later without fighting a redirect browsers have cached forever.
 */
export default function TierListIndexPage() {
  redirect('/tier-list/ranked');
}
