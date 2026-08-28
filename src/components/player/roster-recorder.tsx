"use client";

import { useEffect } from "react";

import { saveRoster } from "@/lib/roster";

/**
 * Renders nothing. Dropped into a profile so that visiting it remembers which
 * brawlers the account owns, on this device only.
 *
 * The ids are already on the page — this is the same roster the grid below
 * draws — so nothing new is collected. What it buys is the draft helper being
 * able to recommend from brawlers you actually have. See `lib/roster`.
 */
export function RosterRecorder({
  tag,
  name,
  owned,
  power11,
}: {
  tag: string;
  name: string;
  owned: number[];
  power11: number[];
}) {
  /*
   * Both arrays are rebuilt on every render of the server component above, so
   * depending on their identity would re-run the effect forever. They are
   * keyed on their contents instead, and rebuilt from those keys inside the
   * effect — the ids are the whole payload, so the string is not a proxy for
   * the array, it *is* the array.
   */
  const ownedKey = owned.join(",");
  const power11Key = power11.join(",");

  useEffect(() => {
    if (!ownedKey) return;
    saveRoster({
      tag,
      name,
      owned: ownedKey.split(",").map(Number),
      power11: power11Key ? power11Key.split(",").map(Number) : [],
    });
  }, [tag, name, ownedKey, power11Key]);

  return null;
}
