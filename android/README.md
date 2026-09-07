# BrawlZone Bubble (Android)

The floating overlay that draws the Ranked tier list on top of Brawl Stars.
Distributed as an APK from [brawlzone.net/bubble](https://brawlzone.net/bubble),
not through the Play Store.

It lives in this repository because it had no other home: for its first six
releases the source existed on exactly one laptop, untracked. Losing that
machine would have meant losing the ability to ship an update at all — see the
keystore note below, which is the part that cannot be recovered.

## What it does, and what it deliberately does not

One thing: draw over another app. That is the only capability a website cannot
have, and it is the whole reason this exists rather than another page on the
site. The panel is a `WebView` pointed at `/bubble/panel`, so the numbers, the
wording and the sampling caveats live in one place and cannot drift.

It cannot read the screen, the match, or which map you are on. Android does not
let one app read another's display.

## Building

Needs a JDK 17 and an Android SDK with platform 34. The Gradle wrapper pins
everything else.

    ./gradlew assembleDebug     # app/build/outputs/apk/debug/
    ./gradlew assembleRelease   # signed, if keystore/ is present

`local.properties` is machine-specific and gitignored; point `sdk.dir` at your
SDK, or set `ANDROID_HOME`.

## The signing key

**`keystore/` is gitignored and is not in this repository.** It holds
`brawlzone-release.jks` and the passwords that open it.

Android identifies an app by its signature. A build signed with a different key
is a *different app*: it cannot install as an update over the copies people
already have, and every existing install would be stranded on whatever version
it happens to be running, forever. There is no recovery and no appeal.

So the key needs a copy somewhere other than the machine that builds it. A
password manager handles both the file and the passwords; anywhere private and
backed-up works. It must never be committed — this repository is public.

Without `keystore/`, `assembleRelease` still runs and produces an unsigned
build; the signing block in `app/build.gradle.kts` is conditional so a fresh
checkout configures cleanly.

## Releasing

1. Bump `versionCode` and `versionName` in `app/build.gradle.kts`. Android
   upgrades on the code, not the name, so the code is the one that must move.
2. Add an entry to `BUBBLE_CHANGELOG` in `src/lib/bubble-app.ts`. The panel
   shows an out-of-date install only what it has not got, using `versionCode`.
3. `./gradlew assembleRelease`, copy the APK to
   `public/downloads/brawlzone-bubble.apk`.
4. Update `BUBBLE_APP` — version, versionCode, size, sha256.
   `src/lib/bubble-app.test.ts` fails until the checksum matches the committed
   file, which is the reminder that would otherwise not exist: a stale checksum
   fails verification on a good download and teaches the one careful reader to
   skip the step.
