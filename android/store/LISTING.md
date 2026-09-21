# Store listing — BrawlZone Bubble

Everything below is paste-ready. The APK is the one the site serves
(`public/downloads/brawlzone-bubble-<version>.apk`), signed with the release
key; a store install and a site install update each other.

## Uptodown (no review gate, no tester requirement)

1. https://www.uptodown.com/developers → sign in with any account → **Upload app**.
2. Upload `public/downloads/brawlzone-bubble-1.14.apk`. Package `net.brawlzone.bubble`, version 1.14 (35).
3. Fill the fields from the sections below. Icon: `android/store/icon-512.png`. Screenshots: `public/bubble/app-home.png`, `app-panel.png`, `app-draft.png`, `app-map.png`, `app-build.png`.
4. Category: **Tools** (or Games › Utilities if offered). Price: Free. Contains ads: No. In-app purchases: No.
5. Website: https://brawlzone.net/bubble · Privacy policy: https://brawlzone.net/privacy · Support: the site's contact on /about.
6. When the listing is live, put its URL in `storeUrl` in `src/lib/bubble-app.ts` and push. The download page shows the link only once that is set.

Each later release: upload the new APK to the same listing. Same key, higher
versionCode — nothing else changes.

## Amazon Appstore (free, no tester requirement; less traffic)

https://developer.amazon.com/apps-and-games → Add new app → Android. Same
assets. Amazon's review takes a few days and checks that the app runs; it
does not require a closed test. The "Display over other apps" permission
should be explained in the review notes — text under **Review notes** below.

## Title

BrawlZone Bubble — Brawl Stars tier list overlay

## Short description (80 chars)

The Ranked tier list floating over Brawl Stars. Free, no ads, no account.

## Full description

BrawlZone Bubble puts the Brawl Stars Ranked tier list on top of the game, as a small floating bubble you can drag anywhere. Tap it during a draft to see which brawlers are winning right now — on the mode and the map you are actually playing — then tap again and it gets out of the way.

What it shows
• The full Ranked tier list, S through D, scored on adjusted win rate and pick rate from sampled competitive battles. The same numbers as brawlzone.net, refreshed on the same schedule.
• Down to the map: Ranked hands you one map from its pool and the answer moves with it. Pick the mode, then the map, and both are remembered.
• A draft board: enter the bans and the picks on both sides and it ranks the brawlers left for you.
• Builds on tap: the star power, gadget and gears each brawler's owners actually run, with the sample size behind every number.

What it does not do
• It does not read your screen, your match, or your account. The only permission it needs is "Display over other apps", which Android asks you to grant in Settings — no app is allowed to grant that to itself.
• No ads, no account, no tracking, no in-app purchases. Nothing to log in to.
• It does not touch the game. It shows the meta; you match it to the draft in front of you.

How it works
Install, open, tap Start. Android sends you to its "Display over other apps" screen once; allow it, come back, and the bubble appears. Drag it onto the ✕ at the bottom to close it, or use Stop in the notification.

Updates
The app checks brawlzone.net for a newer version and offers it inside the bubble. Installing from the store or from the site gives you the same build, signed with the same key, so either one updates the other.

BrawlZone is a fan-made statistics site and is not affiliated with Supercell. Brawl Stars is a trademark of Supercell Oy.

## What's new (1.14)

The draft scan has been removed: it never worked reliably enough across phones to keep, and the app no longer asks for screen capture at all. The draft board stays — enter bans and picks by hand and it ranks the rest. Smaller for it.

## Review notes (Amazon; Uptodown has no field for this)

The app draws a small overlay over other apps (SYSTEM_ALERT_WINDOW), which is its entire purpose: a tier list you can consult while a game is in the foreground. It runs a foreground service with a persistent notification while the overlay is showing, and stops when the user closes the bubble. It requests no other permissions and collects no data. To test: open the app, tap Start, allow "Display over other apps" when sent to Settings, return; a draggable bubble appears; tap it to open the panel.

## Data safety answers

Collects data: No. Shares data: No. Encrypted in transit: Yes (HTTPS to brawlzone.net only). Data deletion: nothing is stored server-side. The app makes network requests to brawlzone.net to load the panel and check for updates; no identifiers are sent.
