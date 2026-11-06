# BrawlZone

Brawl Stars stats, tier lists and draft tools at **[brawlzone.net](https://brawlzone.net)**,
and **BrawlZone Bubble**, an Android overlay that shows the Ranked meta in the middle of a
draft ([Google Play](https://play.google.com/store/apps/details?id=net.brawlzone.bubble)).

Every number on the site comes from real battles that BrawlZone samples itself, refreshed
every two hours. The site is in English, Spanish, Portuguese, Turkish, German, Russian and
French.

## The website

| Section | What it does |
| --- | --- |
| [Tier lists](https://brawlzone.net/tier-list) | Ranked and trophy tier lists, by mode, by rank bracket, over the last 24 hours or 7 days |
| [Maps](https://brawlzone.net/maps) | Best picks, bans and trios for every map in the live Ranked rotation |
| [Draft helper](https://brawlzone.net/draft) | Enter the bans and picks; get picks that beat the enemy and fit your team |
| [Brawlers](https://brawlzone.net/brawlers) | Every brawler: win and pick rate by mode and map, counters, builds, best maps |
| [Compare](https://brawlzone.net/compare) | Two brawlers head to head |
| [Comps](https://brawlzone.net/comps) | Team comps that win, per mode and map |
| [Meta](https://brawlzone.net/meta), [Hidden meta](https://brawlzone.net/hidden-meta), [Daily](https://brawlzone.net/daily) | What moved this week, strong picks few people play, a daily report |
| Players and clubs | Profile lookup: Ranked standing, battle log, recent form, account progression |
| [Free rewards](https://brawlzone.net/rewards) | Every free Supercell reward link as it drops, with optional push notifications |
| [Leaderboards](https://brawlzone.net/leaderboard), [Events](https://brawlzone.net/events), [News](https://brawlzone.net/news), [Patches](https://brawlzone.net/patches) | Top players and clubs by country, the event rotation, official news and balance changes |
| [Starr Drops](https://brawlzone.net/starr-drops), [Cosmetics](https://brawlzone.net/cosmetics), [Account value](https://brawlzone.net/account-value), [Daily challenge](https://brawlzone.net/daily-challenge) | Drop odds and an opener, skins and pins, what an account is worth, a daily guess-the-brawler game |

How the tier lists are scored is explained on [brawlzone.net/meta-score](https://brawlzone.net/meta-score).

## BrawlZone Bubble

A small bubble floats over Brawl Stars. Tap it during a Ranked draft and a panel opens with:

- best picks, bans and trios for the map, at your rank;
- counters to the enemy's picks, and who beats any brawler on your map;
- safe first picks and the most-owned build for each brawler;
- your Ranked form: recent wins and losses, star player, streak, progress to the next rank.

The panel is a page of this site (`/bubble/panel`), so it updates without an app release and
speaks 22 languages. The Android shell lives in [`android/`](android). The app does not read
the screen or touch the game; the player tag is optional.

## Public API

JSON endpoints the site and the Bubble use. Responses are cached for a few minutes, so please
keep request rates reasonable.

| Endpoint | Returns |
| --- | --- |
| `GET /api/v1/tier-list[?format=ranked\|trophy][&window=<days>]` | The current tier list |
| `GET /api/v1/counters?brawler=<id>[&rank=<bracket>][&map=<name>]` | Who beats a brawler, overall, at a rank or on a map |
| `GET /api/v1/draft-suggest?map=<name>[&bans=][&enemies=][&allies=][&rank=]` | Picks for a draft (ids comma-separated) |
| `GET /api/v1/comps` | Winning team comps |
| `GET /api/v1/brawler-build/<id>` | A brawler's most-owned build |
| `GET /api/v1/health` | Service health |

## How the data works

1. The official [Brawl Stars API](https://developer.brawlstars.com) (through RoyaleAPI's
   proxy) gives a player's profile and their last ~25 battles. It has no global stats.
2. A sampler visits a pool of about 10,000 active players every two hours and stores their
   battles, typically 60,000 to 150,000 per run.
3. Win rates come from Ranked games unless a page says trophies. Small samples are pulled
   toward the average, and brawlers below a sample floor are left unrated.
4. A precompute job turns the raw battles into the lists the pages read, so a page view never
   runs a heavy query.
5. Retention windows keep the database bounded: raw battles for 14 days, daily roll-ups for
   longer.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router), React 19, TypeScript, Tailwind CSS
- [Prisma](https://www.prisma.io) 7 and PostgreSQL 17
- One ARM server running Docker Compose (Caddy, the app, Postgres, [Umami](https://umami.is)
  analytics) behind Cloudflare
- systemd timers for sampling, precompute, deploys (every 5 minutes from `main`), nightly
  backups with a weekly restore test, and health checks
- Automation for the Discord bot, YouTube Shorts, Instagram Reels and TikTok (in `deploy/`)

**Before changing caching, sampling or retention, read [AGENTS.md](AGENTS.md).** It records
how this runs in production and the outages that shaped it.

## Running it locally

You need Node 24 and a Brawl Stars API key.

1. Create a key at [developer.brawlstars.com](https://developer.brawlstars.com/#/account).
   For the allowed IP, enter the RoyaleAPI proxy address listed at
   [docs.royaleapi.com/proxy.html](https://docs.royaleapi.com/proxy.html), not your own.
2. Create `.env.local`:

   ```bash
   BRAWL_STARS_API_KEY=your-key
   # Optional. Without a database, player and club lookups work and stat pages show empty states.
   DATABASE_URL=postgresql://user:password@localhost:5432/brawlzone
   ```

3. Install and run:

   ```bash
   npm install
   npm run db:deploy        # apply migrations (with DATABASE_URL set)
   npm run stats:refresh    # one sampling pass, to fill the database
   npm run dev
   ```

Checks, as the deploy runs them:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run crawl:budget     # how many URLs a crawler can reach; fails if the walk never ends
```

## Repository layout

| Path | What is there |
| --- | --- |
| `src/app` | Routes. `[lang]` serves the translated pages; `api/` holds the API routes |
| `src/lib` | Stats queries (`stats.ts`), the sampler (`aggregation.ts`), the API client (`bs-api.ts`), i18n |
| `src/components` | UI, including the Bubble panel (`components/bubble`) |
| `src/i18n` | Site translations |
| `prisma` | Schema and migrations |
| `scripts` | Sampling, precompute, reports and maintenance scripts |
| `deploy` | Server scripts, systemd units, and the slide and video generators |
| `android` | The BrawlZone Bubble app |

## Disclaimer

This material is unofficial and is not endorsed by Supercell. For more information see
Supercell's Fan Content Policy: [www.supercell.com/fan-content-policy](https://www.supercell.com/fan-content-policy).
