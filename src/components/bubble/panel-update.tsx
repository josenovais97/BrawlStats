"use client";

import { useSyncExternalStore } from "react";

import { DownloadButton } from "@/components/bubble/download-button";
import { type BubbleRelease } from "@/lib/bubble-app";

/**
 * The first build whose WebView can actually start a download.
 *
 * A WebView discards download requests unless the app sets a
 * `DownloadListener`, and 1.5 is where that was added. Below it the APK link is
 * a dead button through no fault of the page, so the notice says where to go
 * instead rather than offering a control that does nothing.
 */
const DOWNLOADS_WORK_FROM = 15;

/**
 * Tells an out-of-date install that a newer app exists, and what is in it.
 *
 * The version travels in the URL **hash** — the app loads
 * `/bubble/panel#v=14`. A hash is never sent to the server, so the page stays
 * one fully cached URL; a query string would have opted the route out of
 * caching entirely, which is the trap that cost this project a month of Vercel
 * allowance. The comparison therefore has to happen in the client, which is
 * fine, because the answer is not worth a request.
 *
 * A missing version means an *old* app rather than an unknown one. Versions up
 * to 1.3 shipped before this existed and send no marker at all, so absence is
 * itself the signal — which is what lets the notice reach the installs that
 * most need it, the moment the site deploys, without those installs having to
 * be updated first to find out they are out of date.
 *
 * `useSyncExternalStore` over an effect: `location.hash` is an external store,
 * the server snapshot is a plain null, and the notice appears on the first
 * client render rather than a frame later.
 */
export function PanelUpdate({
  latestVersion,
  latestVersionCode,
  changes,
}: {
  latestVersion: string;
  latestVersionCode: number;
  /** Everything newer than the oldest install we might be talking to. */
  changes: BubbleRelease[];
}) {
  const hash = useSyncExternalStore(subscribe, snapshot, () => null);

  // Null on the server and on the first paint; nothing is drawn until the
  // client can actually answer the question.
  if (hash === null) return null;

  const running = parseVersion(hash);
  if (running !== null && running >= latestVersionCode) return null;

  /*
   * Only what this reader has not got. Someone on 1.3 does not need to be told
   * what 1.1 fixed, and a list that repeats itself every release teaches
   * people to ignore the banner.
   */
  const newer =
    running === null ? changes : changes.filter((r) => r.versionCode > running);
  const lines = newer.flatMap((r) => r.changes).slice(0, 4);

  return (
    <section className="mb-2 overflow-hidden rounded-xl border border-brand/40 bg-brand/10">
      <div className="flex items-baseline justify-between gap-2 px-3 py-2">
        <p className="text-xs font-bold text-brand">
          Version {latestVersion} is out
        </p>
        {/* Straight to the file. Sending someone to the download page from
            inside a 360dp overlay means hunting for a button in a window that
            is not built for reading. */}
        <DownloadButton
          from="panel"
          className="shrink-0 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-bold text-brand-ink"
        >
          Download
        </DownloadButton>
      </div>

      {running === null || running < DOWNLOADS_WORK_FROM ? (
        <p className="px-3 pb-2 text-[11px] leading-snug text-muted">
          On this version the button may do nothing — open{" "}
          <span className="font-semibold text-foreground">
            brawlzone.net/bubble
          </span>{" "}
          in your phone&apos;s browser instead. Updating fixes it.
        </p>
      ) : null}

      {lines.length > 0 ? (
        <ul className="space-y-1 px-3 pb-2.5">
          {lines.map((line) => (
            <li
              key={line}
              className="flex gap-1.5 text-[11px] leading-snug text-muted"
            >
              <span
                aria-hidden
                className="mt-1.5 size-1 shrink-0 rounded-full bg-brand/70"
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** The `v` in `#v=14`, or null when the app did not say. */
function parseVersion(hash: string): number | null {
  const match = /(?:^|[#&])v=(\d+)/.exec(hash);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function snapshot() {
  return window.location.hash;
}
