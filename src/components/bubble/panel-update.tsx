"use client";

import { useSyncExternalStore } from "react";

import { type BubbleRelease } from "@/lib/bubble-app";

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

  /*
   * Up to date still says so, quietly.
   *
   * Rendering nothing was the tidier choice and it cost days. Version drift is
   * invisible from inside the app — the panel is a web page that updates itself
   * on every deploy, so its bug fixes appear instantly while the APK's do not,
   * and a reader testing a fix they have not installed sees new wording around
   * old behaviour. "Nothing changed" then means "I am on the old build", and
   * there is no way to tell from the screen.
   *
   * One line of 10px text ends that. It is the answer to "am I testing what I
   * think I am testing", which is the first question worth asking whenever a
   * fix appears not to have worked.
   */
  if (running !== null && running >= latestVersionCode) {
    return (
      <p className="mb-1.5 px-1 text-right text-[10px] text-muted/70">
        App {latestVersion} · up to date
      </p>
    );
  }

  /*
   * Only what this reader has not got. Someone on 1.3 does not need to be told
   * what 1.1 fixed, and a list that repeats itself every release teaches
   * people to ignore the banner.
   */
  const newer =
    running === null ? changes : changes.filter((r) => r.versionCode > running);

  /*
   * The name of what is installed, when the changelog still carries it.
   * Older builds fall off the end of the list, and a bare code number means
   * nothing to a reader, so this stays silent rather than showing "build 17".
   */
  const runningName =
    running === null
      ? null
      : (changes.find((r) => r.versionCode === running)?.version ?? null);
  const lines = newer.flatMap((r) => r.changes).slice(0, 4);

  return (
    <section className="mb-2 overflow-hidden rounded-xl border border-brand/40 bg-brand/10">
      <div className="flex items-baseline justify-between gap-2 px-3 py-2">
        {/*
          Names both versions, not just the new one.
          
          "Version 1.8.3 is out" is unfalsifiable from the reader's side: they
          have no way to see what they are running, so a banner that is telling
          the truth and a banner that is stuck look identical. Someone who
          updated to 1.8.2 an hour before 1.8.3 shipped reasonably reads a
          correct banner as a bug, and there is nothing on screen to settle it.
          Showing the installed version makes the whole thing checkable at a
          glance — and if it ever really is stuck, that is visible too.
        */}
        <p className="text-xs font-bold text-brand">
          Version {latestVersion} is out
          {runningName ? (
            <span className="ml-1.5 font-semibold text-muted">
              — you have {runningName}
            </span>
          ) : null}
        </p>
        {/*
          An instruction, not a button.
          
          There was a Download button here for four versions and it never once
          worked on the reader's phone. Every attempt to fix it addressed a real
          obstacle — the WebView ignoring the `download` attribute, Android
          blocking an activity start from a service, a missing notification
          permission hiding the completed download — and behind each was another
          one. Meanwhile the file it fetched was a day-stale copy from cache, so
          even the attempts that worked delivered the wrong build.
          
          A sentence naming the address cannot fail. It is worse than a working
          button and far better than a broken one, and after this many rounds
          the honest thing is to stop offering the control and say where to go.
        */}
        <span className="shrink-0 text-[11px] font-semibold text-muted">
          brawlzone.net/bubble
        </span>
      </div>

      <p className="px-3 pb-2 text-[11px] leading-snug text-muted">
        Open that page in your browser to update. The file is named for its
        version, so you can see which build you are getting before you install
        it.
      </p>

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
