"use client";

import { History } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import {
  diffSnapshot,
  readSnapshot,
  subscribeSnapshot,
  writeSnapshot,
} from "@/lib/player-history";

/**
 * "Since your last visit", from a snapshot kept in this browser.
 *
 * Renders nothing on a first visit, nothing when nothing has moved, and
 * nothing at all on the server — there is no snapshot until the browser has
 * one, so this is deliberately client-side and appears after hydration rather
 * than reserving space for something that usually will not exist.
 *
 * The read happens before the write, so arriving at a profile shows the change
 * since last time rather than a freshly-zeroed comparison.
 */
export function SinceLastVisit({
  tag,
  trophies,
  brawlers,
  power11,
  hyperCharges,
  skill,
}: {
  tag: string;
  trophies: number;
  brawlers: number;
  power11: number;
  hyperCharges: number;
  skill: number;
}) {
  const current = { trophies, brawlers, power11, hyperCharges, skill };

  /*
   * Read through `useSyncExternalStore` rather than into state from an effect.
   *
   * The server has no localStorage, so the server snapshot is null and the
   * section is simply absent from the HTML — no hydration mismatch, and no
   * space reserved for something most visits will not show.
   */
  const previous = useSyncExternalStore(
    subscribeSnapshot,
    () => readSnapshot(tag),
    () => null,
  );

  // Written after the read above, so arriving at a profile shows the change
  // since last time rather than a freshly-zeroed comparison. The individual
  // numbers are the dependencies rather than the object holding them, which is
  // rebuilt on every render and would re-run this forever.
  useEffect(() => {
    writeSnapshot(tag, {
      trophies,
      brawlers,
      power11,
      hyperCharges,
      skill,
      at: Date.now(),
    });
  }, [tag, trophies, brawlers, power11, hyperCharges, skill]);

  if (!previous) return null;
  const delta = diffSnapshot(previous, current);
  if (delta.unchanged) return null;

  const rows: { label: string; value: number; decimals?: number }[] = [
    { label: "Trophies", value: delta.trophies },
    { label: "Brawlers", value: delta.brawlers },
    { label: "Power 11", value: delta.power11 },
    { label: "Hypercharges", value: delta.hyperCharges },
    { label: "Skill score", value: delta.skill, decimals: 1 },
  ].filter((row) => row.value !== 0);

  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="since-last-visit"
      className="card overflow-hidden border-brand/25"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface-2/50 px-4 py-2">
        <p
          id="since-last-visit"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand"
        >
          <History className="size-3.5" />
          Since your last visit
        </p>
        <p className="text-xs text-muted">
          {delta.days === 1 ? "1 day ago" : `${delta.days} days ago`} · kept in
          this browser only
        </p>
      </div>

      {/* Wraps rather than scrolls: at 320px this is two per row, which stays
          readable without a horizontal gesture. */}
      <dl className="flex flex-wrap gap-x-6 gap-y-3 px-4 py-3">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs uppercase tracking-wide text-muted">
              {row.label}
            </dt>
            <dd
              className={`text-lg font-black tabular-nums ${
                row.value > 0 ? "text-victory" : "text-defeat"
              }`}
            >
              {row.value > 0 ? "+" : "−"}
              {Math.abs(row.value).toLocaleString("en-US", {
                minimumFractionDigits: row.decimals ?? 0,
                maximumFractionDigits: row.decimals ?? 0,
              })}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
