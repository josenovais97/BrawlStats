import { Radio } from "lucide-react";

import { getBattleLog } from "@/lib/bs-api";
import { minutesSince, relativeTime } from "@/lib/format";

/** Under this many minutes since the last battle, treat the player as online. */
const ONLINE_WINDOW_MINUTES = 15;

/**
 * When the player was last seen in a match.
 *
 * The API has no "last online" field, but the battle log is ordered newest
 * first, so the timestamp of the most recent battle is exactly that: the last
 * moment the account was provably in a game. It costs nothing extra either —
 * the battle log below the fold fetches the same URL, and Next dedupes it
 * within a render.
 *
 * Renders nothing when the log is empty or unavailable, which is the honest
 * answer: an absent log means we cannot say, not that they never played.
 */
export async function LastOnline({ tag }: { tag: string }) {
  let newest: string | undefined;
  try {
    newest = (await getBattleLog(tag)).items[0]?.battleTime;
  } catch {
    return null;
  }
  if (!newest) return null;

  const minutesAgo = minutesSince(newest);
  if (minutesAgo === null) return null;

  const online = minutesAgo <= ONLINE_WINDOW_MINUTES;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium ${
        online
          ? "border-victory/40 bg-victory/10 text-victory"
          : "border-border bg-surface-2 text-muted"
      }`}
    >
      {online ? (
        <span className="live-dot" />
      ) : (
        <Radio className="size-3.5" aria-hidden />
      )}
      {online ? "In a match recently" : `Last seen ${relativeTime(newest)}`}
    </span>
  );
}
