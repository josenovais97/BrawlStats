import type { Metadata } from "next";
import {
  ArrowRight,
  Download,
  Hand,
  Layers,
  MousePointerClick,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { PageHeading, SectionHeading } from "@/components/ui/section-heading";
import { BUBBLE_APP, bubbleAppSize } from "@/lib/bubble-app";

/**
 * The Android app's download page.
 *
 * Written for someone who is about to install software from a website, which
 * is a thing people are right to be wary of. So the page leads with what the
 * app does, says plainly why it needs the one permission that sounds alarming,
 * publishes a checksum, and walks the install through the exact screens
 * Android will put in the way — including the greyed-out toggle, which is the
 * step that stops people and is not mentioned anywhere in Android's own UI.
 *
 * The limitation is stated as prominently as the feature. An overlay cannot
 * read the game's screen, and a page that let someone discover that after
 * installing would deserve the uninstall.
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

const STEPS = [
  {
    n: 1,
    title: "Download and open the file",
    body: "Your browser will ask whether to keep a file of this type. It is an app installer, so Chrome and Android both check with you first — that prompt is normal and you can allow it.",
  },
  {
    n: 2,
    title: "Allow installing from your browser",
    body: 'Android asks once per app that installs other apps. "Allow from this source" appears the first time; after that it remembers.',
  },
  {
    n: 3,
    title: "Open BrawlZone and tap Start bubble",
    body: 'The first tap sends you to Android’s "Display over other apps" screen, because no app can grant itself that permission.',
  },
  {
    n: 4,
    title: "If the toggle is greyed out",
    body: 'Android blocks this permission for apps installed outside a store. Go to Settings › Apps › BrawlZone, tap the ⋮ menu at the top right, choose "Allow restricted settings", then try again. This step catches almost everyone.',
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
    body: "The panel folds out of the bubble with the current Ranked tier list. Tap the bubble again and it folds back in.",
  },
  {
    icon: Hand,
    title: "Drag to move",
    body: "Put it wherever it is not in the way. It rests against the nearest edge when you let go, and stays there.",
  },
  {
    icon: X,
    title: "Drag down to close",
    body: "A target appears at the bottom of the screen while you drag. Drop the bubble on it to close, or use Stop in the notification.",
  },
];

export default function BubblePage() {
  return (
    <div className="space-y-14">
      <PageHeading
        eyebrow="Android app"
        title="BrawlZone Bubble"
        subtitle="The Ranked tier list, floating on top of the game. Check the meta without leaving your draft."
      />

      {/* Download and one screenshot, side by side: what you get and what it
          looks like, before any explanation is asked for. */}
      <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <p className="text-lg leading-relaxed text-muted">
            Brawl Stars gives you seconds to pick. Switching apps to check a
            tier list costs more of them than you have — so this puts the list
            on top of the game instead, one tap away, and gets out of the way
            when you are done.
          </p>

          <a
            href={BUBBLE_APP.path}
            download
            className="inline-flex items-center gap-3 rounded-xl bg-brand px-6 py-3.5 font-bold text-brand-ink transition-transform hover:-translate-y-0.5"
          >
            <Download className="size-5" />
            Download for Android
          </a>

          <p className="text-sm text-muted">
            Version {BUBBLE_APP.version} · {bubbleAppSize()} · Android{" "}
            {BUBBLE_APP.minAndroid} or newer · free, no ads, no account
          </p>

          {/* A checksum is only worth printing if it is right, so it is
              generated from the committed file rather than typed. */}
          <details className="card p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Verify the download
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              You should be careful about installing apps from websites. This
              one is signed with a key we hold, and you can confirm the file you
              got is the file we published:
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
              SHA-256
            </p>
            <code className="mt-1 block overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">
              {BUBBLE_APP.sha256}
            </code>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              On a phone, apps like Hash Droid will show it. On a desktop:{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">
                sha256sum brawlzone-bubble.apk
              </code>
            </p>
          </details>
        </div>

        <div className="mx-auto w-full max-w-[280px]">
          <Image
            src="/bubble/app-bubble.png"
            alt="The BrawlZone bubble floating over an Android home screen, with the tier list panel open beneath it"
            width={540}
            height={1200}
            className="w-full rounded-2xl border border-border"
            priority
          />
        </div>
      </section>

      {/* Why it helps, in terms of the decision it changes. */}
      <section className="space-y-4">
        <SectionHeading
          title="What it is for"
          subtitle="One question, answered where you are already looking."
        />

        {/* The panel beside the claims, because it is the product: three cards
            describing a tier list are weaker than the tier list itself. */}
        <div className="grid items-start gap-8 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="mx-auto w-full max-w-[280px]">
            <Image
              src="/bubble/app-panel.png"
              alt="The bubble's panel showing the Ranked tier list, S through D with meta scores, and the live rotation underneath"
              width={720}
              height={1280}
              className="w-full rounded-2xl border border-border"
              loading="lazy"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <article className="card p-5">
              <Layers className="size-6 text-brand" />
              <h3 className="mt-3 font-bold">The Ranked tier list</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                S through D, scored on adjusted win rate and pick rate from
                sampled competitive battles. The same numbers as the site,
                refreshed on the same schedule.
              </p>
            </article>

            <article className="card p-5">
              <Smartphone className="size-6 text-brand" />
              <h3 className="mt-3 font-bold">Without leaving the game</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Switching apps mid-draft risks the timer and can drop you back
                into a lobby. The overlay draws on top instead, so the game
                keeps running underneath.
              </p>
            </article>

            <article className="card p-5">
              <ShieldCheck className="size-6 text-brand" />
              <h3 className="mt-3 font-bold">What is live right now</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                The current rotation is listed under the tier list, so you can
                see which maps the names above are being ranked against.
              </p>
            </article>
          </div>
        </div>

        {/*
          The limit, given the same weight as the features.

          Every overlay tool of this kind gets asked whether it reads the game,
          and the honest answer is a selling point rather than a caveat: it
          cannot, by design, and neither can anything else on the Play Store.
        */}
        <div className="card border-border-strong p-5">
          <h3 className="font-bold">What it cannot do</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The bubble cannot see your screen, your match, or which map you are
            on — Android does not let one app read another&apos;s display, and
            nothing that claims otherwise is doing it legitimately. It shows the
            meta and the live rotation; you match that to the draft in front of
            you. It does not touch the game, read your account, or send anything
            anywhere.
          </p>
        </div>
      </section>

      {/* The install, including the step Android does not explain. */}
      <section className="space-y-4">
        <SectionHeading
          title="Installing it"
          subtitle="Five steps, and the fourth is the one that stops people."
        />

        <ol className="card divide-y divide-border overflow-hidden">
          {STEPS.map((step) => (
            <li key={step.n} className="flex gap-4 p-5">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-black tabular-nums ${
                  step.warn
                    ? "bg-brand text-brand-ink"
                    : "bg-surface-2 text-muted"
                }`}
              >
                {step.n}
              </span>
              <div className="min-w-0">
                <h3 className="font-bold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="text-sm leading-relaxed text-muted">
          Google Play Protect may warn you about any app installed outside the
          Play Store. That warning is about where the file came from, not about
          what is in it — which is what the checksum above is for.
        </p>
      </section>

      {/* Using it. The drag-to-close gesture in particular is undiscoverable
          without being told once. */}
      <section className="space-y-4">
        <SectionHeading
          title="Using it"
          subtitle="Three gestures, and that is the whole app."
        />

        <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="mx-auto w-full max-w-[280px] lg:order-2">
            <Image
              src="/bubble/app-home.png"
              alt="The BrawlZone app's main screen, showing the permission status and Start bubble button"
              width={540}
              height={1200}
              className="w-full rounded-2xl border border-border"
              loading="lazy"
            />
          </div>

          <ul className="space-y-4 lg:order-1">
            {GESTURES.map((g) => (
              <li key={g.title} className="card flex gap-4 p-5">
                <g.icon className="size-6 shrink-0 text-brand" />
                <div className="min-w-0">
                  <h3 className="font-bold">{g.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {g.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card card-glow p-6 sm:p-8">
        <h2 className="display text-2xl uppercase">Prefer the browser?</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Everything the bubble shows is on the site, with far more behind it —
          per-map picks, team comps, matchups and your own profile. The app
          exists only to save you the app switch.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/tier-list/ranked"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-bold text-brand-ink transition-transform hover:-translate-y-0.5"
          >
            Ranked tier list
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/draft"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 font-semibold transition-colors hover:border-brand/50"
          >
            Draft helper
          </Link>
        </div>
      </section>
    </div>
  );
}
