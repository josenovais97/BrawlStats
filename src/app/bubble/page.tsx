import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  Download,
  Hand,
  Layers,
  ListOrdered,
  Map as MapIcon,
  MousePointerClick,
  ShieldCheck,
  Swords,
  Users,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { DemoVideo } from "@/components/bubble/demo-video";
import { DownloadButton } from "@/components/bubble/download-button";
import { GooglePlayBadge } from "@/components/store-badges";
import { SectionHeading } from "@/components/ui/section-heading";
import { BUBBLE_APP, BUBBLE_CHANGELOG, PLAY_TEST, bubbleAppSize } from "@/lib/bubble-app";
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

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
    "A draft helper that floats over Brawl Stars: tier lists at your rank, the best picks for your map, counters, team comps and builds, with your own brawlers marked. Free, no ads, no account.",
  openGraph: {
    title: "BrawlZone Bubble for Android",
    description:
      "The Ranked tier list, floating on top of the game. Free download, no ads, no account.",
  },
};

const TRUST = ["Free forever", "No ads", "No account", "No tracking"];

/*
 * What the panel does, in the order a draft asks for it (rewritten for 1.29:
 * the old three cards still described the tier list as the whole app).
 */
const FEATURES = [
  {
    icon: Layers,
    title: "The tier list at your rank",
    body: "Diamond, Mythic, Legendary and Masters play different metas, so the list is split by rank and opens on yours. Every Ranked mode, refreshed every two hours from real competitive battles.",
  },
  {
    icon: MapIcon,
    title: "The best picks for your map",
    body: "Ranked hands you one map, and the answer moves with it. Pick the map and get the brawlers that win there, with your own best pick named at the top.",
  },
  {
    icon: Users,
    title: "Team comps",
    body: "The three that win together on your map, with the ones you own ticked.",
  },
  {
    icon: Swords,
    title: "Draft counters",
    body: "Enter the bans and both teams' picks and it ranks what is left. Tap an enemy to see who beats them.",
  },
  {
    icon: Wrench,
    title: "Builds on tap",
    body: "Tap any brawler for the star power, gadget and gears its owners actually run, with the sample size behind every number.",
  },
  {
    icon: UserCheck,
    title: "Your brawlers marked",
    body: "Add your player tag once: brawlers you own are marked, the rest greyed out or hidden, and you can narrow it to power 11 or hypercharged.",
  },
];

/* The account card, since 1.25; account switching since 1.29. */
const ACCOUNT = [
  {
    title: "Your tag, once",
    body: "The app finds your account and puts your player icon on the bubble. Every pick the panel suggests is one you can actually make.",
  },
  {
    title: "Two accounts? One tap",
    body: "Every tag you use is saved. Switch between them from the account card; a long press removes one.",
  },
  {
    title: "What to upgrade next",
    body: "A short plan for your coins: the few brawlers that would give you a top pick in the most modes.",
  },
  {
    title: "Your language, your bubble",
    body: "22 languages, with brawler, mode and map names exactly as the game writes them. Choose the bubble's size, how faint it gets when idle, and whether it tucks half off the edge.",
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
  {
    icon: ListOrdered,
    title: "Start it from inside the game",
    body: "Add the BrawlZone tile to Quick Settings: swipe down mid-match and tap it to show or hide the bubble, without opening the app.",
  },
];


export default function BubblePage() {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  return (
    <div className="space-y-16 sm:space-y-24">
      {/* Hero. The claim, the proof and the button, before anything is explained. */}
      <section className="space-y-7">
        {/* Two columns on a wide screen: the pitch, and the way to get it
            onto the device that can actually run it. The QR used to sit
            under the trust row, which left the whole right of the hero
            empty on desktop and buried the code below the fold on the very
            screens it exists for. */}
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-6">
            <div className="max-w-3xl space-y-5">
              <p className="flex items-center gap-2.5">
                <span aria-hidden className="rule h-4" />
                <span className="eyebrow">{t('Free Android app')}</span>
              </p>

              <h1 className="display text-4xl uppercase leading-[1.05] sm:text-5xl lg:text-6xl">{t('Your draft helper,')}<br />
                <span className="text-brand">{t('on top of the game')}</span>
              </h1>

              <p className="max-w-2xl text-lg leading-relaxed text-muted">{t('Brawl Stars gives you seconds to pick. Leaving the game to check a tier list costs more of them than you have, so the answer comes to you instead: the meta at your rank, the best picks for your map and what beats the enemy, one tap away over the game.')}</p>
            </div>

            {/*
              Google Play first while its closed test is recruiting: every new
              install that goes through Play is a tester, and Play keeps the
              app updated. The APK stays, smaller, for phones without Google
              Play and for anyone who will not join a group.
            */}
            {PLAY_TEST.open ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  <Link href={lp('/bubble/test')} aria-label={t('Get it on Google Play')} className="transition-transform hover:-translate-y-0.5">
                    <GooglePlayBadge className="h-14 w-auto" />
                  </Link>
                  <Link
                    href={lp('/bubble/test')}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-bold text-brand-ink transition-transform hover:-translate-y-0.5"
                  >
                    {t('Join the test')}
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
                <p className="text-sm text-muted">
                  {t('No Google Play on your phone?')}{' '}
                  <DownloadButton from="hero" className="font-semibold text-foreground underline underline-offset-2">
                    {t('Download the APK')}
                  </DownloadButton>{' '}
                  {t('Version {version} · {v} · Android', { version: BUBBLE_APP.version, v: bubbleAppSize() })}{" "}{t('{minAndroid} or newer', { minAndroid: BUBBLE_APP.minAndroid })}
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <DownloadButton
                  from="hero"
                  className="inline-flex items-center gap-3 rounded-xl bg-brand px-7 py-4 text-lg font-bold text-brand-ink transition-transform hover:-translate-y-0.5"
                >
                  <Download className="size-5" />{t('Download for Android')}</DownloadButton>
                <p className="text-sm text-muted">{t('Version {version} · {v} · Android', { version: BUBBLE_APP.version, v: bubbleAppSize() })}{" "}{t('{minAndroid} or newer', { minAndroid: BUBBLE_APP.minAndroid })}</p>
              </div>
            )}

            {/* The store listing, for readers who will not sideload. Same
                build, same key; see `storeUrl`. */}
            {BUBBLE_APP.storeUrl ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <a
                  href={lp(BUBBLE_APP.storeUrl)}
                  rel="noopener"
                  className="inline-flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 transition-[transform,border-color] hover:-translate-y-0.5 hover:border-brand/50"
                >
                  <Image
                    src={BUBBLE_APP.storeIcon}
                    alt=""
                    width={74}
                    height={74}
                    className="size-8"
                    unoptimized
                  />
                  <span className="flex flex-col leading-tight">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t('Get it on')}</span>
                    <span className="font-bold">{BUBBLE_APP.storeName}</span>
                  </span>
                </a>
                <p className="text-sm text-muted">{t('Prefer a store? The same signed file, so either one updates the other.')}</p>
              </div>
            ) : null}

            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {TRUST.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm font-semibold"
                >
                  <Check className="size-4 text-victory" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/*
            For the reader on a desktop, where the download button hands them an
            APK their computer cannot install.

            Points at this page rather than the file: someone arriving on a phone
            needs the install steps — the restricted-settings one in particular —
            and a QR that starts a download gives them the file with none of that.
            Hidden below `lg`, because scanning a code with the phone displaying
            it is not a thing anyone can do.
          */}
          <div className="hidden shrink-0 rounded-2xl border border-border bg-surface p-5 text-center lg:block">
            <Image
              src="/bubble/qr.svg"
              alt={t('QR code linking to brawlzone.net/bubble')}
              width={330}
              height={330}
              className="mx-auto size-36 rounded-lg"
              unoptimized
            />
            <div className="mt-3 max-w-[13rem]">
              <p className="font-bold">{t('On a computer?')}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t('Scan to open this page on your Android phone, where the app can actually be installed.')}</p>
            </div>
          </div>
        </div>

        {/*
          The video beside the proof. The video is the tour (made for the Play
          listing and TikTok); the photo is one unedited moment on a real
          phone, which is the claim the section beside it makes.
        */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <figure className="card-glow mx-auto w-full max-w-[20rem] overflow-hidden rounded-2xl border border-border">
            <DemoVideo />
            <figcaption className="border-t border-border bg-surface px-4 py-3 text-xs leading-relaxed text-muted">{t('The whole app in 51 seconds. Sound on.')}</figcaption>
          </figure>

          <div className="card card-glow space-y-4 p-6 sm:p-8">
            <h2 className="display text-2xl uppercase sm:text-3xl">{t('A website cannot do this')}</h2>
            <p className="leading-relaxed text-muted">{t('Not this one, not any of them. A browser tab cannot draw on top of another app — the sandbox forbids it, on every phone. Checking a tier list in a browser means leaving the draft, and leaving the draft is what costs you the pick.')}</p>
            <p className="leading-relaxed text-muted">{t('An app can. The bubble sits on the edge of the screen, opens on a tap over the game, and folds away again.')}</p>
            <figure className="space-y-2 pt-2">
              <Image
                src="/bubble/over-game.jpg"
                alt={t('The BrawlZone panel open on top of the Brawl Stars lobby on a phone, showing the Ranked meta for Masters+ on Undermine')}
                width={2048}
                height={912}
                className="w-full rounded-xl border border-border"
                loading="lazy"
              />
              <figcaption className="text-center text-xs text-muted">{t('On a real phone, open over the game')}</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* What you get, beside the thing itself. */}
      <section className="space-y-5">
        <SectionHeading
          title={t('Everything in one bubble')}
          subtitle={t('The same data as the site, cut down to what a draft needs.')}
        />

        {/* Both screens, because they answer different questions: what the
            meta looks like, and what to actually run once you have picked. */}
        <div className="grid gap-4 sm:grid-cols-3">
          <figure className="space-y-2">
            <Image
              src="/bubble/panel-meta.png"
              alt={t('The panel\'s Ranked meta at Mythic: rank and mode chips across the top, then the tier list from S down, with the brawlers you do not own greyed out')}
              width={720}
              height={1360}
              className="w-full rounded-2xl border border-border"
              loading="lazy"
            />
            <figcaption className="text-center text-xs text-muted">{t('Pick your rank and mode')}</figcaption>
          </figure>

          <figure className="space-y-2">
            <Image
              src="/bubble/panel-map.png"
              alt={t('Pinball Dreams at Mythic: the best picks on that map, your best owned pick named above the list, and the battles behind each number')}
              width={720}
              height={1360}
              className="w-full rounded-2xl border border-border"
              loading="lazy"
            />
            <figcaption className="text-center text-xs text-muted">{t('Then the map you are on')}</figcaption>
          </figure>

          <figure className="space-y-2">
            <Image
              src="/bubble/panel-build.png"
              alt={t('The build card for Shade: the most-owned star power, gadget and two gears, with the share of sampled owners holding each')}
              width={720}
              height={1360}
              className="w-full rounded-2xl border border-border"
              loading="lazy"
            />
            <figcaption className="text-center text-xs text-muted">{t('Tap a brawler for its build')}</figcaption>
          </figure>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="card p-5">
              <f.icon className="size-6 text-brand" />
              <h3 className="mt-3 font-bold">{t(f.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {t(f.body)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* The second tab, which is the tool rather than the glance. */}
      <section className="space-y-5">
        <SectionHeading
          title={t('Or draft with it')}
          subtitle={t('A second tab, for when you want more than the meta: the bans, your team, and theirs.')}
        />

        <div className="grid items-center gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="mx-auto w-full max-w-[300px]">
            <Image
              src="/bubble/panel-draft.png"
              alt={t('The draft board on Hard Rock Mine with one ban, one team-mate and two enemies entered, and the remaining brawlers ranked by how well they answer that draft')}
              width={720}
              height={1360}
              className="w-full rounded-2xl border border-border"
              loading="lazy"
            />
          </div>

          <div className="space-y-4 text-muted">
            <p className="leading-relaxed">{t('Enter the bans, what your team has taken and what theirs has, and the list reorders around all three. A brawler that is merely strong on the map is a different call from one that is strong on the map')}{' '}<em>{t('and')}</em>{' '}{t('answers what they just picked.')}</p>
            <p className="leading-relaxed">{t('Every row shows its working: form on this map, edge against the enemies you named, edge alongside your team-mates. A suggestion you cannot check is a guess dressed up in a percentage — and mid-draft the reason is usually what decides it.')}</p>
            <p className="leading-relaxed">{t('Tap an enemy pick to see the five brawlers that beat it most often at your rank, with a link to the full counters page on the site.')}</p>
            <p className="leading-relaxed">
              {/* Said plainly because the alternative is a reader trusting a
                  number that a dozen battles produced. */}{t('Thin evidence is flagged rather than hidden. A brawler backed by eleven battles on this map says so in red, because 52% off eleven battles and 52% off two hundred are not the same claim.')}</p>
          </div>
        </div>
      </section>

      {/* The account card: what the app knows about you, and only that. */}
      <section className="space-y-5">
        <SectionHeading
          title={t('Made for your account')}
          subtitle={t('Your tag is the only setup there is, and it changes every list in the panel.')}
        />

        <div className="grid items-center gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="mx-auto w-full max-w-[300px]">
            <Image
              src="/bubble/app-account.jpg"
              alt={t('The app\'s account card: the player name, tag and trophies, the choice between all owned brawlers, power 11 only or hypercharged, and a saved second account to switch to')}
              width={912}
              height={1290}
              className="w-full rounded-2xl border border-border"
              loading="lazy"
            />
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {ACCOUNT.map((item) => (
              <li key={item.title} className="card p-5">
                <h3 className="font-bold">{t(item.title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(item.body)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/*
        The limit, given the same weight as the features.

        Every overlay tool gets asked whether it reads the game. Between 1.8 and
        1.13 this one could, when asked to, and this section was an account of
        what happened to the picture. The scan was removed in 1.14 — it never
        worked reliably enough across phones to keep — and the answer is back to
        the one that needs no account at all: it cannot, by design.
      */}
      <section className="space-y-5">
        <SectionHeading
          title={t('What it cannot do')}
          subtitle={t('Worth knowing before you install it, not after.')}
        />
        <div className="card border-border-strong p-6">
          <div className="flex gap-4">
            <ShieldCheck className="size-6 shrink-0 text-brand" />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>{t('The bubble does not read your screen, your match, or which map you are on. It asks to draw over other apps and to show a notification, the one that says it is running. No screen capture, no storage access, nothing else.')}</p>
              <p>{t('It shows the stats; you make the picks. It does not touch the game or log in to your account: your player tag only looks up your public profile, the same one anyone can see on the site. No ads, no sign-up, no in-app purchases.')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Install. Step four is the one that stops people. */}
      <section className="space-y-5">
        <SectionHeading
          title={t('Installing it')}
          subtitle={t('Five steps, and the fourth is where Android gets in your way.')}
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
                <h3 className="font-bold">{t(step.title)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {t(step.body)}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* While the Google Play closed test is recruiting (PLAY_TEST). */}
        {PLAY_TEST.open ? (
          <Link
            href={lp('/bubble/test')}
            className="card card-interactive flex items-center justify-between gap-4 border-victory/40 p-5"
          >
            <span>
              <span className="block font-bold text-victory">{t('Coming to Google Play')}</span>
              <span className="mt-1 block text-sm text-muted">{t('Join the test and install it from the Play Store instead: three taps.')}</span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-victory" />
          </Link>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="text-sm font-bold">{t('About Play Protect')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t('Google Play Protect warns about any app installed outside the Play Store. That warning is about where a file came from, not about what is in it.')}</p>
          </div>

          {/* A checksum is only worth printing if it is right, so it is generated
              from the committed file and asserted against it in the test run. */}
          <details className="card p-5">
            <summary className="cursor-pointer text-sm font-bold">{t('Verify the download')}</summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{t('Confirm the file you got is the file published here. On a desktop:')}{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{t('sha256sum brawlzone-bubble.apk')}</code>
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{t('SHA-256')}</p>
            <code className="mt-1 block overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">
              {BUBBLE_APP.sha256}
            </code>
          </details>
        </div>
      </section>


      {/* Three gestures, and that is the entire app. */}
      <section className="space-y-5">
        <SectionHeading
          title={t('Using it')}
          subtitle={t('Three gestures and a tile. There is nothing else to learn.')}
        />

        <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <ul className="space-y-4">
            {GESTURES.map((g) => (
              <li key={g.title} className="card flex gap-4 p-5">
                <g.icon className="size-6 shrink-0 text-brand" />
                <div className="min-w-0">
                  <h3 className="font-bold">{t(g.title)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {t(g.body)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mx-auto w-full max-w-[260px]">
            <Image
              src="/bubble/app-home-2.jpg"
              alt={t('The BrawlZone Bubble app\'s main screen: the Start bubble, Stop and Quick Settings buttons, and a list of what the panel does')}
              width={912}
              height={1854}
              className="w-full rounded-2xl border border-border"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* The changelog, on the page people reach from the panel's update
          notice. Newest first, and the current build is marked so a reader can
          tell at a glance whether they are already on it. */}
      <section id="changelog" className="space-y-5 scroll-mt-24">
        <SectionHeading
          title={t('What\'s new')}
          subtitle={t('The app updates by downloading again — it installs over the top and keeps your permission.')}
        />

        {/*
          The newest release, then everything else folded away.

          A changelog that prints every version in full turns into the longest
          section on the page within a few releases, and buries the download
          under a history almost nobody wants. What a reader here actually asks
          is "what changed since I installed it" — and the panel's own update
          notice answers that precisely, because it knows their version. This is
          the public copy, so the current release leads and the archive stays one
          click away rather than gone.
        */}
        <article className="card p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="display text-lg uppercase">{t('Version {version}', { version: BUBBLE_CHANGELOG[0].version })}</h3>
            <span className="rounded-md bg-brand/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand">{t('Latest')}</span>
            <time
              className="text-xs text-muted"
              dateTime={BUBBLE_CHANGELOG[0].date}
            >
              {BUBBLE_CHANGELOG[0].date}
            </time>
          </div>

          <ul className="mt-3 space-y-2">
            {BUBBLE_CHANGELOG[0].changes.map((change) => (
              <li
                key={change}
                className="flex gap-2.5 text-sm leading-relaxed text-muted"
              >
                <span
                  aria-hidden
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-brand/60"
                />
                <span>{t(change)}</span>
              </li>
            ))}
          </ul>
        </article>

        {BUBBLE_CHANGELOG.length > 1 ? (
          <details className="card p-5">
            <summary className="cursor-pointer text-sm font-bold">{t('Earlier versions (')}{BUBBLE_CHANGELOG.length - 1})
            </summary>

            <ol className="mt-4 space-y-5">
              {BUBBLE_CHANGELOG.slice(1).map((release) => (
                <li key={release.versionCode}>
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h3 className="font-bold">{t('Version')}{' '}{release.version}</h3>
                    <time
                      className="text-xs text-muted"
                      dateTime={release.date}
                    >
                      {release.date}
                    </time>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {release.changes.map((change) => (
                      <li
                        key={change}
                        className="flex gap-2.5 text-sm leading-relaxed text-muted"
                      >
                        <span
                          aria-hidden
                          className="mt-2 size-1.5 shrink-0 rounded-full bg-muted/40"
                        />
                        <span>{t(change)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </section>

      <section className="card card-glow p-6 text-center sm:p-10">
        <h2 className="display text-2xl uppercase sm:text-3xl">{t('Get it on your phone')}</h2>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted">{t('Free, {v}, no account. Everything it shows is on the site too — the app only saves you the app switch, which is the part that costs you the draft.', { v: bubbleAppSize() })}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {PLAY_TEST.open ? (
            <Link href={lp('/bubble/test')} aria-label={t('Get it on Google Play')} className="transition-transform hover:-translate-y-0.5">
              <GooglePlayBadge className="h-[3.25rem] w-auto" />
            </Link>
          ) : null}
          <DownloadButton
            from="cta"
            className={
              PLAY_TEST.open
                ? "inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3.5 font-semibold transition-colors hover:border-brand/50"
                : "inline-flex items-center gap-3 rounded-xl bg-brand px-6 py-3.5 font-bold text-brand-ink transition-transform hover:-translate-y-0.5"
            }
          >
            <Download className="size-5" />{PLAY_TEST.open ? t('Download the APK') : t('Download for Android')}</DownloadButton>
          <Link
            href={lp('/tier-list/ranked')}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3.5 font-semibold transition-colors hover:border-brand/50"
          >{t('Or use the site')}<ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
