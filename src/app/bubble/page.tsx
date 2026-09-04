import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  Download,
  Hand,
  Layers,
  MousePointerClick,
  ShieldCheck,
  Timer,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { DemoVideo } from "@/components/bubble/demo-video";
import { SectionHeading } from "@/components/ui/section-heading";
import { BUBBLE_APP, bubbleAppSize } from "@/lib/bubble-app";

/**
 * The Android app's download page.
 *
 * Written for someone about to install software from a website, which people
 * are right to be wary of. So it leads with the thing running in a real match,
 * says plainly why it needs the one permission that sounds alarming, publishes
 * a checksum, and walks the install through the exact screens Android puts in
 * the way — including the greyed-out toggle, which stops nearly everyone and is
 * explained nowhere in Android's own UI.
 *
 * The pitch rests on a fact rather than a boast: a website cannot draw over
 * another app. That is not a gap in any particular competitor's product, it is
 * the browser sandbox, and it is the whole reason this exists as an APK. A
 * claim about what rival sites do or do not ship would need checking and would
 * go stale; "the web physically cannot do this" needs neither.
 *
 * The limitation gets the same weight as the feature. An overlay cannot read
 * the game's screen, and a page that let someone discover that after installing
 * would deserve the uninstall.
 */

export const metadata: Metadata = {
  alternates: { canonical: "/bubble" },
  title: "BrawlZone Bubble for Android",
  description:
    "A floating bubble that puts the Ranked tier list on top of Brawl Stars, so you can check the meta mid-draft without leaving the game. Free, no ads, no account.",
  openGraph: {
    title: "BrawlZone Bubble for Android",
    description:
      "The Ranked tier list, floating on top of the game. Free download, no ads, no account.",
  },
};

const TRUST = ["Free forever", "No ads", "No account", "No tracking"];

const FEATURES = [
  {
    icon: Layers,
    title: "The full Ranked tier list",
    body: "S through D, scored on adjusted win rate and pick rate from sampled competitive battles. The same numbers as the site, refreshed on the same schedule.",
  },
  {
    icon: Timer,
    title: "Filtered to the mode you are in",
    body: "Knockout and Brawl Ball are different metas. One tap narrows the list to the mode you are drafting, and it remembers your choice for next time.",
  },
  {
    icon: MousePointerClick,
    title: "Builds on tap",
    body: "Tap any brawler for the star power, gadget and gears its owners actually run, with the sample size behind every number.",
  },
];

const STEPS = [
  {
    n: 1,
    title: "Download and open the file",
    body: "Your browser asks whether to keep a file of this type. It is an app installer, so Chrome and Android both check with you first — that prompt is normal.",
  },
  {
    n: 2,
    title: "Allow installing from your browser",
    body: 'Android asks once per app that installs other apps. "Allow from this source" appears the first time; after that it remembers.',
  },
  {
    n: 3,
    title: "Open BrawlZone and tap Start bubble",
    body: 'The first tap sends you to Android\'s "Display over other apps" screen, because no app is allowed to grant itself that permission.',
  },
  {
    n: 4,
    title: "If the toggle is greyed out",
    body: 'Android blocks this permission for apps installed outside a store. Go to Settings › Apps › BrawlZone, tap the ⋮ menu at the top right, choose "Allow restricted settings", then try again. This catches almost everyone, and Android never explains it.',
    warn: true,
  },
  {
    n: 5,
    title: "Switch it on and go back",
    body: "The bubble appears straight away and stays on top of whatever you open next, including the game.",
  },
];

const GESTURES = [
  {
    icon: MousePointerClick,
    title: "Tap to open",
    body: "The panel folds out of the bubble. Tap the bubble again and it folds back in.",
  },
  {
    icon: Hand,
    title: "Drag to move",
    body: "Put it wherever it is not in the way. It rests against the nearest edge when you let go, and stays there.",
  },
  {
    icon: X,
    title: "Drag down to close",
    body: "A target appears at the bottom of the screen while you drag. Drop the bubble on it, or use Stop in the notification.",
  },
];

export default function BubblePage() {
  return (
    <div className="space-y-16 sm:space-y-24">
      {/* Hero. The claim, the proof and the button, before anything is explained. */}
      <section className="space-y-7">
        <div className="max-w-3xl space-y-5">
          <p className="flex items-center gap-2.5">
            <span aria-hidden className="rule h-4" />
            <span className="eyebrow">Free Android app</span>
          </p>

          <h1 className="display text-4xl uppercase leading-[1.05] sm:text-5xl lg:text-6xl">
            The tier list,
            <br />
            <span className="text-brand">on top of the game</span>
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-muted">
            Brawl Stars gives you seconds to pick. Leaving the game to check a tier list costs
            more of them than you have — so the list comes to you instead, one tap away, and gets
            out of the way when you are done.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <a
            href={BUBBLE_APP.path}
            download
            className="inline-flex items-center gap-3 rounded-xl bg-brand px-7 py-4 text-lg font-bold text-brand-ink transition-transform hover:-translate-y-0.5"
          >
            <Download className="size-5" />
            Download for Android
          </a>
          <p className="text-sm text-muted">
            Version {BUBBLE_APP.version} · {bubbleAppSize()} · Android {BUBBLE_APP.minAndroid} or
            newer
          </p>
        </div>

        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {TRUST.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm font-semibold">
              <Check className="size-4 text-victory" />
              {item}
            </li>
          ))}
        </ul>

        {/* The recording carries the page. Everything below it is detail. */}
        <figure className="card-glow overflow-hidden rounded-2xl border border-border">
          <DemoVideo />
          <figcaption className="border-t border-border bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
            One unedited take on a phone: queueing into Hot Zone, opening the bubble mid-draft,
            filtering to the mode being played, checking Bo&apos;s build, then picking Bo and
            switching to the star power the panel pointed at. Taps are marked.
          </figcaption>
        </figure>
      </section>

      {/*
        Why it is an app at all.

        The honest differentiator, and a fact rather than a boast: no website can
        draw over another app, on any phone, for anyone. That is the browser
        sandbox, not a gap in somebody's product, and unlike a claim about
        competitors it will not go stale.
      */}
      <section className="card card-glow p-6 sm:p-10">
        <div className="max-w-3xl space-y-4">
          <h2 className="display text-2xl uppercase sm:text-3xl">A website cannot do this</h2>
          <p className="leading-relaxed text-muted">
            Not this one, not any of them. A browser tab cannot draw on top of another app — the
            sandbox forbids it, on every phone. Checking a tier list in a browser means leaving
            the draft, and leaving the draft is what costs you the pick.
          </p>
          <p className="leading-relaxed text-muted">
            An installed app can. That is the whole reason this exists as an APK rather than
            another page on the site, and it is all the app does: draw the numbers over the game,
            then get out of the way.
          </p>
        </div>
      </section>

      {/* What you get, beside the thing itself. */}
      <section className="space-y-5">
        <SectionHeading
          title="What is in the panel"
          subtitle="The same data as the site, cut down to what a draft needs."
        />

        <div className="grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="mx-auto w-full max-w-[300px]">
            <Image
              src="/bubble/app-panel.png"
              alt="The panel showing the Ranked tier list from S to D with meta scores, the mode filter across the top, and the live rotation below"
              width={720}
              height={1280}
              className="w-full rounded-2xl border border-border"
              loading="lazy"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {FEATURES.map((f) => (
              <article key={f.title} className="card p-5">
                <f.icon className="size-6 text-brand" />
                <h3 className="mt-3 font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/*
        The limit, given the same weight as the features.

        Every overlay tool gets asked whether it reads the game, and the honest
        answer is a selling point rather than a caveat: it cannot, by design, and
        neither can anything else that is playing by the rules.
      */}
      <section className="space-y-5">
        <SectionHeading
          title="What it cannot do"
          subtitle="Worth knowing before you install it, not after."
        />
        <div className="card border-border-strong p-6">
          <div className="flex gap-4">
            <ShieldCheck className="size-6 shrink-0 text-brand" />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>
                The bubble cannot see your screen, your match, or which map you are on. Android
                does not let one app read another&apos;s display, and anything claiming otherwise
                is not playing by the rules.
              </p>
              <p>
                It shows the meta; you match that to the draft in front of you. It does not touch
                the game, read your account, or send anything anywhere — there is no account, no
                analytics in the app, and nothing to log in to.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Install. Step four is the one that stops people. */}
      <section className="space-y-5">
        <SectionHeading
          title="Installing it"
          subtitle="Five steps, and the fourth is where Android gets in your way."
        />

        <ol className="card divide-y divide-border overflow-hidden">
          {STEPS.map((step) => (
            <li key={step.n} className="flex gap-4 p-5">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-black tabular-nums ${
                  step.warn ? "bg-brand text-brand-ink" : "bg-surface-2 text-muted"
                }`}
              >
                {step.n}
              </span>
              <div className="min-w-0">
                <h3 className="font-bold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="text-sm font-bold">About Play Protect</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Google Play Protect warns about any app installed outside the Play Store. That
              warning is about where a file came from, not about what is in it.
            </p>
          </div>

          {/* A checksum is only worth printing if it is right, so it is generated
              from the committed file and asserted against it in the test run. */}
          <details className="card p-5">
            <summary className="cursor-pointer text-sm font-bold">Verify the download</summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Confirm the file you got is the file published here. On a desktop:{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">
                sha256sum brawlzone-bubble.apk
              </code>
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
              SHA-256
            </p>
            <code className="mt-1 block overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">
              {BUBBLE_APP.sha256}
            </code>
          </details>
        </div>
      </section>

      {/* Three gestures, and that is the entire app. */}
      <section className="space-y-5">
        <SectionHeading
          title="Using it"
          subtitle="Three gestures. There is nothing else to learn."
        />

        <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <ul className="space-y-4">
            {GESTURES.map((g) => (
              <li key={g.title} className="card flex gap-4 p-5">
                <g.icon className="size-6 shrink-0 text-brand" />
                <div className="min-w-0">
                  <h3 className="font-bold">{g.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{g.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mx-auto w-full max-w-[260px]">
            <Image
              src="/bubble/app-home.png"
              alt="The BrawlZone app's main screen, showing the permission status and the Start bubble button"
              width={540}
              height={1200}
              className="w-full rounded-2xl border border-border"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section className="card card-glow p-6 text-center sm:p-10">
        <h2 className="display text-2xl uppercase sm:text-3xl">Get it on your phone</h2>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted">
          Free, {bubbleAppSize()}, no account. Everything it shows is on the site too — the app
          only saves you the app switch, which is the part that costs you the draft.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={BUBBLE_APP.path}
            download
            className="inline-flex items-center gap-3 rounded-xl bg-brand px-6 py-3.5 font-bold text-brand-ink transition-transform hover:-translate-y-0.5"
          >
            <Download className="size-5" />
            Download for Android
          </a>
          <Link
            href="/tier-list/ranked"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3.5 font-semibold transition-colors hover:border-brand/50"
          >
            Or use the site
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
