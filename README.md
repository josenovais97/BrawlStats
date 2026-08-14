# BrawlStats

A Brawl Stars stats site in the spirit of brawlify.com — player and club lookup, a brawler
database, live event rotation, leaderboards, and a tier list built from aggregated battle
samples.

Built with Next.js (App Router) + TypeScript + Tailwind CSS, deployable free on Vercel with
Neon Postgres.

## Features

| Page | What it does |
| --- | --- |
| `/` | Tag search for players and clubs, plus a global top-5 preview |
| `/player/[tag]` | Trophies, level, 3v3 / showdown records, ranked, club, battle log, full brawler grid |
| `/club/[tag]` | Club info, requirements, and a searchable member list with roles |
| `/brawlers` | Every brawler, filterable by rarity and class |
| `/brawlers/[id]` | Star powers, gadgets, aggregated win/usage rate, and the global top 10 on that brawler |
| `/tier-list` | S–D tiers from aggregated battle samples, read from Postgres |
| `/events` | Live and upcoming event rotation with map art |
| `/leaderboard` | Top 100 players or clubs, filterable by region |

## Architecture

### The API key never reaches the browser

The official API token is read from `BRAWL_STARS_API_KEY` (deliberately **not**
`NEXT_PUBLIC_`) and used only inside `src/lib/bs-api.ts`, which imports `server-only`. That
import turns any accidental inclusion in a client bundle into a build error.

Pages are React Server Components that call the API client directly. Client components
(search box, filters, leaderboard controls) never fetch — they navigate, and the server
re-renders. The routes under `src/app/api/` expose the same data as JSON for anything that
does need a client-side or external fetch.

### Everything goes through the RoyaleAPI proxy

The official API whitelists your key against a fixed IP, and Vercel's serverless functions
have no stable outbound IP. So all official-API traffic goes to
`https://bsproxy.royaleapi.dev/v1` instead of `https://api.brawlstars.com/v1` — identical
paths and auth, different host. Your key must be whitelisted against **RoyaleAPI's proxy
IP**, not your own. See [Setup](#setup).

`https://api.brawlapi.com` (artwork, descriptions, map images) needs no key and is called
directly.

### Caching

| Data | Revalidate |
| --- | --- |
| Player, battle log, club | 60s |
| Rankings, event rotation | 120s |
| Brawler metadata (brawlapi) | 24h |
| Tier list (reads Postgres) | 1h |

Short windows keep lookups fresh while collapsing bursts of traffic into one upstream call,
which is what keeps the site inside the API rate limit.

### Error handling

`src/lib/errors.ts` defines one error vocabulary (`notFound`, `rateLimited`, `unauthorized`,
`upstreamDown`, `timeout`, `invalidTag`, `notConfigured`) with user-facing copy. Upstream
status codes are mapped into it, and pages render `<ErrorState>`. A raw upstream body is
never shown.

Tags are normalised before any request: `#` stripped, uppercased, `O`→`0` and `I`→`1`
(neither letter appears in real tags), then validated against the tag alphabet
`0289PYLQGRJCUV` so typos fail locally instead of spending an API call. They are re-encoded
as `%23ABC123` for the upstream path.

## Setup

### 1. Get an API key

1. Register at [developer.brawlstars.com](https://developer.brawlstars.com/#/account).
2. Create a new key.
3. **For the allowed IP, enter the RoyaleAPI proxy IP — not your own.** The current address
   is listed at [docs.royaleapi.com/proxy.html](https://docs.royaleapi.com/proxy.html).
   Using your own IP will work locally and then fail on Vercel with `403`, because
   serverless functions have no fixed outbound address.

### 2. Install and configure

```bash
git clone <your-repo> && cd brawlstats
npm install
cp .env.local.example .env.local
```

Fill in `BRAWL_STARS_API_KEY`. The site runs without a database — only the tier list and
the aggregated stats on brawler pages need one.

```bash
npm run dev
```

### 3. Provision Neon Postgres (optional, for the tier list)

1. In the Vercel dashboard: **Storage → Create Database → Neon** (Marketplace integration,
   free tier).
2. Connect it to your project. Vercel injects `DATABASE_URL` into every environment.
3. Pull it locally:

   ```bash
   npx vercel env pull .env.local
   ```

4. Apply the schema:

   ```bash
   npm run db:deploy     # production: applies prisma/migrations
   # or, while iterating locally:
   npm run db:migrate
   ```

   > Migrations run over `DATABASE_URL_UNPOOLED`, falling back to `DATABASE_URL`
   > (see `prisma.config.ts`). Neon's pooled endpoint is PgBouncer in transaction
   > mode and does not hold the session state migrations need. The Neon
   > integration injects both variables, so this works without extra setup — but
   > if you copy a connection string by hand, use the **unpooled** one for
   > migrations and the pooled one for `DATABASE_URL` at runtime.
   >
   > Quote the values in `.env.local` (`DATABASE_URL="postgres://…"`). The pooled
   > URL contains `&`, which breaks `source .env.local` in a shell if unquoted.

5. Seed the sampling pool and collect the first batch:

   ```bash
   npm run db:seed
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/refresh-stats
   ```

> Prisma 7 takes the migration URL from `prisma.config.ts` and the runtime connection from a
> driver adapter (`@prisma/adapter-pg`) — there is no `url` in `schema.prisma`.

### 4. Deploy

Set these in **Vercel → Settings → Environment Variables** before the first deploy:

| Variable | Required | Notes |
| --- | --- | --- |
| `BRAWL_STARS_API_KEY` | yes | Whitelisted against the RoyaleAPI proxy IP |
| `DATABASE_URL` | for the tier list | Pooled connection; injected by the Neon integration |
| `DATABASE_URL_UNPOOLED` | for migrations | Direct connection; injected by the Neon integration |
| `CRON_SECRET` | auto | Vercel provisions this for projects with cron jobs |

Adding the database **after** a deployment does not retrofit the env vars into it —
redeploy so the build picks them up, otherwise the tier list keeps rendering its
"Database not configured" state from the older build.

`vercel.json` declares one daily cron job. The Hobby plan allows **one run per day per job**,
which is why the schedule is `0 4 * * *` rather than hourly.

## The tier list, honestly

`vercel.json` triggers `/api/cron/refresh-stats` daily. The route checks
`Authorization: Bearer $CRON_SECRET` and **fails closed** if `CRON_SECRET` is unset,
so the endpoint is never an open trigger. Each run:

1. **Seeds** `sampled_players` from the global leaderboard and top club rosters, up to 500.
2. **Samples** the 25 least-recently-sampled players (2 API calls each, concurrency 2, with
   backoff on throttling), writing:
   - `player_brawler_snapshots` — trophies, rank and power per brawler per day,
   - `battle_samples` — one row per battle recording only *that player's own* brawler and
     result. Teammates are excluded: counting every participant inflates the sample with
     correlated rows.
3. **Aggregates** the trailing 7 days into `brawler_stats` (win rate, usage rate, avg
   trophies, avg rank, sample sizes). Idempotent — re-running overwrites the day's row.

The tier list page reads only `brawler_stats`, so it is fast and costs no API quota.

### Why the percentages are "adjusted"

**The sample is biased, and the site says so on the page.** The pool is seeded from top
ladder and top clubs, and those players win roughly **77%** of their games with *any*
brawler. Raw win rates therefore come back in the 70–93% range, and a naive tier list puts
every brawler in S.

So tiers are assigned on a **baseline-relative** rate: each brawler's win rate minus the
sampled cohort's mean, re-centred on 50%. In a real run that turned a 70–93% raw band into a
29–66% adjusted spread that actually discriminates. Both numbers are shown — adjusted as the
headline, raw in the tooltip and on the brawler page.

Re-centring removes the cohort's *skill* bias. It does not remove its *taste*: which
brawlers top players choose to run is still baked into the usage rate, and into which
brawlers clear the sample threshold at all. Brawlers with fewer than 30 decided battles are
listed as unrated rather than given a tier.

**To make this genuinely representative** you would need to sample across the trophy range,
not just the top: pull from regional leaderboards at several trophy bands, keep a much
larger pool, and let the window run long enough that low-usage brawlers clear the threshold.
The current setup is a working pipeline with an honest caveat, not a finished methodology.

### Tuning

- Batch size: `POST /api/cron/refresh-stats?batch=50` (1–100, default 25).
- Window, concurrency, pool target and retry count: constants at the top of
  `src/lib/aggregation.ts`.
- Tier thresholds and the sample floor: `src/lib/stats.ts`.

Note the Hobby plan's one-run-per-day cron limit caps how fast the sample grows. Raising
`batch` is the lever; watch for `partial` runs in `aggregation_runs`, which record why
samples failed.

## API routes

| Route | Description |
| --- | --- |
| `GET /api/player/[tag]` | Player profile |
| `GET /api/player/[tag]/battlelog` | Last ~25 battles |
| `GET /api/club/[tag]` | Club with members |
| `GET /api/rankings/players?region=&limit=` | Player leaderboard |
| `GET /api/rankings/clubs?region=&limit=` | Club leaderboard |
| `GET /api/events` | Event rotation |
| `POST /api/cron/refresh-stats?batch=` | Aggregation job (requires `CRON_SECRET`) |

Tags are passed without `#`. Errors return
`{ error: { code, title, detail } }` with an appropriate status.

## Project layout

```
prisma/schema.prisma        Neon Postgres schema (snapshots, samples, aggregates)
prisma.config.ts            Prisma 7 config — migration datasource
scripts/seed-stats.ts       Fills the sampling pool without a full run
src/lib/bs-api.ts           Official API client (server-only, via RoyaleAPI proxy)
src/lib/brawlapi.ts         Keyless artwork/metadata client
src/lib/aggregation.ts      Sampling + aggregation pipeline (write side)
src/lib/stats.ts            Tier-list reads, normalisation, tier assignment
src/lib/tags.ts             Tag normalise / validate / encode
src/lib/errors.ts           Shared error vocabulary and user-facing copy
src/types/                  Interfaces for every API response and DB row
```

## Notes

- Icons are [lucide-react](https://lucide.dev) throughout; there are no emoji in the UI.
- Brawler, map and mode artwork comes from Brawlify's CDN via brawlapi.com metadata.
  `next/image` is configured for those hosts in `next.config.ts` and uses `unoptimized` for
  CDN sprites to avoid burning Vercel's image-optimisation quota on assets that are already
  small and cached.
- The theme is dark-only by design: Brawl Stars artwork is drawn on dark backgrounds.

This material is unofficial and is not endorsed by Supercell. See Supercell's Fan Content
Policy.
