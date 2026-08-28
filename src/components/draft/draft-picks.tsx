"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

import { formatNumber, formatPercent } from "@/lib/format";
import { readRosters, serverRosters, subscribeRosters } from "@/lib/roster";
import { brawlerPath } from "@/lib/slugs";

export interface DraftPick {
  brawlerId: number;
  brawlerName: string;
  iconUrl: string;
  score: number | null;
  decidedSampleSize: number;
  /** Win-rate edge against the named enemies, or null when unmeasured. */
  edge: number | null;
}

/**
 * The recommendation list, filterable down to brawlers you actually own.
 *
 * A Ranked draft is chosen from what is in your account, and a list topped by
 * a brawler you have never unlocked is advice you cannot take. The roster is
 * already remembered on this device from looking your own profile up, so the
 * filter costs nothing and asks for nothing — no account, and no request.
 *
 * Nothing renders until a roster is found, so a first-time visitor never sees
 * a control that would do nothing. Power 11 is offered separately because
 * Ranked above Mythic requires it: owning a brawler and being allowed to field
 * it are different questions.
 */
export function DraftPicks({
  picks,
  hasEnemies,
}: {
  picks: DraftPick[];
  hasEnemies: boolean;
}) {
  const [scope, setScope] = useState<"all" | "owned" | "power11">("all");

  /*
   * localStorage is an external store, and the server has none. The server
   * snapshot is empty, so the first render matches the HTML and the control
   * appears once the roster is read — no state-setting effect, no cascade.
   */
  const rosters = useSyncExternalStore(
    subscribeRosters,
    readRosters,
    serverRosters,
  );
  const roster = rosters[0];

  const shown = useMemo(() => {
    if (!roster || scope === "all") return picks;
    const ids = new Set(scope === "power11" ? roster.power11 : roster.owned);
    return picks.filter((pick) => ids.has(pick.brawlerId));
  }, [picks, roster, scope]);

  return (
    <>
      {roster ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Show
          </span>
          <Scope active={scope === "all"} onClick={() => setScope("all")}>
            Every brawler
          </Scope>
          <Scope active={scope === "owned"} onClick={() => setScope("owned")}>
            {roster.name} owns
          </Scope>
          {roster.power11.length > 0 ? (
            <Scope
              active={scope === "power11"}
              onClick={() => setScope("power11")}
            >
              At power 11
            </Scope>
          ) : null}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="card p-6 text-sm leading-relaxed text-muted">
          None of the brawlers with a record on this map are in that list.
        </p>
      ) : (
        <ol className="card divide-y divide-border overflow-hidden">
          {shown.map((pick, index) => (
            <li key={pick.brawlerId}>
              <Link
                href={brawlerPath(pick.brawlerId, pick.brawlerName)}
                className="row-interactive flex items-center gap-3 px-4 py-3"
              >
                <span
                  className={`w-6 shrink-0 text-center text-sm font-black tabular-nums ${
                    index === 0 ? "text-brand" : "text-muted"
                  }`}
                >
                  {index + 1}
                </span>
                <Image
                  src={pick.iconUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-lg bg-surface-2"
                  loading="lazy"
                  unoptimized
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold capitalize">
                    {pick.brawlerName.toLowerCase()}
                  </span>
                  <span className="block text-xs tabular-nums text-muted">
                    {formatNumber(pick.decidedSampleSize)} battles here
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold tabular-nums text-victory">
                    {formatPercent(pick.score)}
                  </span>
                  {pick.edge !== null ? (
                    <span
                      className={`block text-xs tabular-nums ${
                        pick.edge > 0 ? "text-victory/80" : "text-defeat/80"
                      }`}
                    >
                      {pick.edge > 0 ? "+" : "−"}
                      {Math.abs(pick.edge * 100).toFixed(1)} vs their picks
                    </span>
                  ) : hasEnemies ? (
                    <span className="block text-xs text-muted">
                      no matchup data
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function Scope({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-9 max-w-full items-center truncate rounded-lg px-3 text-xs font-semibold transition-colors ${
        active
          ? "bg-brand text-brand-ink"
          : "border border-border bg-surface-2/60 text-muted hover:border-border-strong hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
