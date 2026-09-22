# Store listing — BrawlZone Bubble

Everything below is paste-ready. The APK is the one the site serves
(`public/downloads/brawlzone-bubble-<version>.apk`), signed with the release
key; a store install and a site install update each other.

## Uptodown (no review gate, no tester requirement)

1. https://www.uptodown.com/developers → sign in with any account → **Upload app**.
2. Upload `public/downloads/brawlzone-bubble-1.15.apk`. Package `net.brawlzone.bubble`, version 1.15 (36).
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

## Resubmission note (after the 2026-09-22 rejection as a "webview app")

The first submission's five screenshots all showed the panel filling the
screen, which is exactly what a WebView wrapper looks like. Nothing showed the
one thing a browser cannot do. For the resubmission:

- Screenshots 1 and 2 must be the ones taken on a phone with the game open:
  the bubble resting over the match, and the panel open over it. The panel
  shots move to 3-5.
- Version 1.15 (36) adds two native features on top of the overlay: a Quick
  Settings tile that starts and stops the bubble from the shade, and a Panel
  action in the notification. Upload the new APK under Files.
- The description below now opens with what is native and says plainly that
  the panel's content is served live from brawlzone.net -- reviewers can see
  a WebView in the APK, and a listing that pretends otherwise reads worse than
  one that explains why.

## Title

BrawlZone Bubble — Brawl Stars tier list overlay

## Short description (80 chars)

A floating tier list over Brawl Stars. Overlay, Quick Settings tile, no ads.

## Full description

BrawlZone Bubble is a floating overlay for Brawl Stars. It draws a small movable bubble on top of the game — something no website or browser tab can do — and a tap opens the current Ranked tier list right there, mid-draft, on the mode and the map you are playing. Tap again and it folds away.

What is native
• The bubble itself: a system overlay ("Display over other apps") that floats above Brawl Stars and any other app, drags anywhere, snaps to the nearest edge, and closes by dropping it on the ✕.
• A Quick Settings tile: swipe down from inside the game and tap BrawlZone to put the bubble up or take it down, without opening the app. On Android 13 and up the app adds the tile for you with one tap.
• A foreground service with a persistent notification while the overlay is showing, with Panel and Stop buttons in the shade.
• In-app updates: the app checks brawlzone.net for a newer version and downloads and installs it itself.

What the panel shows
• The full Ranked tier list, S through D, scored on adjusted win rate and pick rate from sampled competitive battles, refreshed every two hours.
• Down to the map: Ranked hands you one map from its pool and the answer moves with it. Pick the mode, then the map; both are remembered.
• A draft board: enter the bans and the picks on both sides and it ranks the brawlers left for you.
• Builds on tap: the star power, gadget and gears each brawler's owners actually run, with the sample size behind every number.

The panel's content is served live from brawlzone.net, so the numbers are the same as the site's and update without an app update. Everything around it — the overlay, the tile, the service, the notification, the updater — is the app.

What it does not do
• It does not read your screen, your match, or your account. It needs "Display over other apps", which Android asks you to grant in Settings, and nothing else.
• No ads, no account, no tracking, no in-app purchases.
• It does not touch the game. It shows the meta; you match it to the draft in front of you.

BrawlZone is a fan-made statistics site and is not affiliated with Supercell. Brawl Stars is a trademark of Supercell Oy.

## What's new (1.15)

A BrawlZone tile for Quick Settings: swipe down from inside the game and tap it to put the bubble up or take it down, without opening the app. The notification gains a Panel button. Android 13 and up can add the tile with one tap from the app screen.

## Review notes (Amazon; Uptodown has no field for this)

The app draws a small overlay over other apps (SYSTEM_ALERT_WINDOW), which is its entire purpose, and adds a Quick Settings tile (TileService) that toggles it from the shade. The panel inside the overlay is a WebView of brawlzone.net/bubble/panel; the overlay, tile, service and updater are native: a tier list you can consult while a game is in the foreground. It runs a foreground service with a persistent notification while the overlay is showing, and stops when the user closes the bubble. It requests no other permissions and collects no data. To test: open the app, tap Start, allow "Display over other apps" when sent to Settings, return; a draggable bubble appears; tap it to open the panel.

## Data safety answers

Collects data: No. Shares data: No. Encrypted in transit: Yes (HTTPS to brawlzone.net only). Data deletion: nothing is stored server-side. The app makes network requests to brawlzone.net to load the panel and check for updates; no identifiers are sent.
