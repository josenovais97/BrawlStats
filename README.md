# Brawl Zone

A Brawl Stars stats site in the spirit of brawlify.com — player and club lookup, a brawler
database, live event rotation, leaderboards, and a tier list built from aggregated battle
samples.

Built with Next.js (App Router) + TypeScript + Tailwind CSS, deployable free on Vercel with
Neon Postgres.

## Features

| Page | What it does |
| --- | --- |
| `/` | Tag search for players and clubs, plus a global top-5 preview |
| `/player/[tag]` | Trophies, ranked tiers, world/brawler rankings, standing, battle log, brawler grid and a progression breakdown |
| `/club/[tag]` | Club info, roster insights (trophy spread, composition, top contributors) and a searchable member list |
| `/brawlers` | Every brawler, filterable by rarity and class |
| `/brawlers/[id]` | Star powers, gadgets, win/pick rate, popular build, and the global top 10 on that brawler |
| `/tier-list` | S–D tiers from aggregated battle samples, plus which brawlers are moving |
| `/ranked` | Best brawlers per map in the Ranked rotation, from competitive battles only |
| `/release-notes` | The latest official update notes, resolved automatically |
| `/about` | What the site is, where data comes from, and its known limits |
| `/news` | Official Supercell announcements and detected game changes (see below) |
| `/events` | Live and upcoming event rotation with map art |
| `/leaderboard` | Top 100 players or clubs, filterable across all ~250 ISO countries |

### Recent form

Built from the battle log (~25 battles, which is all the API keeps):

- Win/loss split, net trophy swing and star-player count
- Most played brawlers with per-brawler win rate and trophy change
- Repeat teammates and opponents, linked to their profiles
- Activity: battles in the last 24h, battles per day, last seen

Everything here is labelled "recent" because the window genuinely is — there is no
endpoint for career battle history.

### Player rankings and standing

Profiles surface three kinds of position:

- **Ranked tiers** — current, season-best and all-time-best, with elo.
- **World rank** — global trophy leaderboard position, when in the top 200.
- **Brawler placements** — every global brawler leaderboard the player appears on,
  banded by top 10 / 25 / 50 / 100 / 200.

> The rankings endpoint hard-caps at **200 entries**, so top-200 is the deepest placement
> that exists — there is no top-250 or top-500 to show. Boards are cached daily by the cron
> job into `brawler_ranking_entries`: resolving placements live would cost ~106 API calls
> per profile view, versus one indexed query against the cache.

Trophy standing is a percentile against every player we have sampled, and is suppressed
below a population of 100 rather than shown from a handful of rows.

### Progression breakdown

The player page reports how much of the game an account has unlocked: brawlers, brawlers at
power 11, star powers, gadgets, gears, hypercharges and buffies, each against the total the
game currently has, plus an overall completion percentage counting every power-level step
and every unlockable ability.

It also estimates coins and power points invested, time played, matches played, and the
coins still needed to take every unlocked brawler to power 11.

Playtime inverts an assumed win rate, since the API reports victories but never games
played: 3v3 is symmetric so wins are roughly half of games, solo showdown pays 1 in 10 and
duo 1 in 5, multiplied by typical match lengths. Rough by construction and labelled as an
estimate.

**Bling is not exposed by the API** and cannot be derived, so there is no bling figure.

> **These are estimates.** `src/lib/progression.ts` holds a hard-coded economy table and is
> the one file to update when Supercell changes upgrade costs. The per-level values there
> were validated against two independently published totals (3,740 power points / 7,765
> coins for power 1→11, and 310/560 to reach power 6). Buffies are counted for completion
> but excluded from the coin estimate, because they also come from keys and drops. The API
> reports only the skin *currently equipped* on each brawler, never the full wardrobe, so
> there is no "skins owned" figure — claiming one would be fiction.
>
> **Buffie totals are derived, not assumed.** There is no buffie catalogue in the API, and
> assuming three per brawler badly overstates the denominator (318 when the observed number
> is 63). `getReleasedBuffieCount()` counts the distinct (brawler, kind) pairs anyone in the
> sampled population owns, which self-corrects as more ship.

### Recent searches

Looked-up tags are remembered in `localStorage` and offered under the search bar, so nobody
has to memorise their own tag or a friend's. This is device-local and anonymous: nothing is
sent to the server, and "Clear all" removes it.

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
| Aggregate database reads | 1h (`READ_CACHE_SECONDS`) |

Short windows keep lookups fresh while collapsing bursts of traffic into one upstream call,
which is what keeps the site inside the API rate limit.

The last row is about Neon, not the game API. Most content routes are server-rendered per
request — `/maps/[mode]/[map]` alone is 400+ URLs — so before caching, every crawler hit
re-ran the aggregate queries. That was measured at 0.37 GB/day of egress against a 5 GB
monthly allowance. The reads in `src/lib/stats.ts` are wrapped with `cachedRead`, so many
renders share one query; `getBestPicksByMode` in particular is identical for every map page
in a mode.

`getLastAggregationRun` is deliberately **not** cached. It is the site's own freshness claim
("Sampled 2 hours ago"), and a cached freshness claim is a contradiction — it reported
superseded runs until it was excluded. Anything keyed by player tag is uncached too: those
answer "how am *I* doing" for someone who has usually just played.

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
git clone <your-repo> && cd brawlzone
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

> `SITE_URL` in `src/lib/site.ts` falls back to the production origin when
> `NEXT_PUBLIC_SITE_URL` is unset, so local development needs no extra configuration. Set it
> in Vercel, and everything derived from it — canonicals, sitemap, Open Graph, and the
> `User-Agent` sent to the wiki and news APIs — follows automatically. It is the only place
> the domain is written down.

### 4. Deploy

Set these in **Vercel → Settings → Environment Variables** before the first deploy:

| Variable | Required | Notes |
| --- | --- | --- |
| `BRAWL_STARS_API_KEY` | yes | Whitelisted against the RoyaleAPI proxy IP |
| `DATABASE_URL` | for the tier list | Pooled connection; injected by the Neon integration |
| `DATABASE_URL_UNPOOLED` | for migrations | Direct connection; injected by the Neon integration |
| `CRON_SECRET` | yes | Also add it as a **GitHub Actions secret** — the sampling workflow sends it |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical origin, e.g. `https://brawlzone.net`. Feeds every canonical tag, the sitemap, OG tags and the outbound `User-Agent` |

Adding the database **after** a deployment does not retrofit the env vars into it —
redeploy so the build picks them up, otherwise the tier list keeps rendering its
"Database not configured" state from the older build.

Sampling is driven by **GitHub Actions**, not Vercel Cron — see
[the tier list](#the-tier-list-honestly) for why. `CRON_SECRET` therefore has to exist in two
places: Vercel, where the route checks it, and the repository's Actions secrets, where the
workflow reads it from. A missing Actions secret fails the run loudly rather than silently
skipping it.

The workflow must also point at the **canonical domain**. It called the old `*.vercel.app`
host until that was set to redirect, at which point every run failed: `curl` without `-L`
sees the `308` and stops. Adding `-L` would not have helped either — the redirect crosses
hosts, and curl drops the `Authorization` header on a cross-host redirect, trading the 308
for a 401.

`vercel.json` still declares two cron entries as a fallback, though they have not been
observed firing.

`vercel.json` also pins functions to `fra1`. The Neon database lives in `eu-central-1`, and
the default region (`iad1`) put every query on a transatlantic round trip.

## The tier list, honestly

`.github/workflows/refresh-stats.yml` calls `/api/cron/refresh-stats` every three hours
(`17 */3 * * *`). The route checks `Authorization: Bearer $CRON_SECRET` and **fails closed**
if `CRON_SECRET` is unset, so the endpoint is never an open trigger.

GitHub Actions rather than Vercel Cron: the Hobby plan allows two cron jobs triggered once a
day, and once a day is not enough — a battle log holds only a player's last ~25 matches, so
anything played between visits is lost for good. The `vercel.json` entries remain as a
nominal fallback, though in practice they have not been observed firing. Note that GitHub's
scheduler delivers late under load — delays of an hour or more are normal, and its own docs
warn that queued jobs may be dropped entirely.

Each run:

1. **Seeds** `sampled_players` from global and regional leaderboards plus top club rosters,
   holding the pool at `POOL_TARGET` (1,000) by evicting the least useful members.
2. **Samples** the pool least-recently-sampled first (2 API calls each, concurrency 5, with
   backoff on throttling), writing:
   - `player_brawler_snapshots` — trophies, rank, power and equipped skin per brawler per day,
   - `battle_samples` — one row per battle recording only *that player's own* brawler and
     result. Teammates are excluded: counting every participant inflates the sample with
     correlated rows.
   - `battle_team_samples` — who stood beside and against that brawler, for matchups only.
3. **Rolls up** the raw rows into daily aggregates (see [Storage](#storage)). Only days whose
   raw rows have actually changed are refolded.
4. **Aggregates** the trailing 7 days into `brawler_stats` (win rate, usage rate, avg
   trophies, avg rank, sample sizes). Idempotent — re-running overwrites the day's row.
5. **Prunes** anything past its retention window, refusing to delete raw days that have not
   been rolled up yet.

The tier list page reads `brawler_stats` and the daily roll-ups, never the live API.

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
brawlers clear the sample threshold at all. Brawlers with fewer than 20 decided battles are
listed as unrated rather than given a tier.

**To make this genuinely representative** you would need to sample across the trophy range,
not just the top: pull from regional leaderboards at several trophy bands, keep a much
larger pool, and let the window run long enough that low-usage brawlers clear the threshold.
The current setup is a working pipeline with an honest caveat, not a finished methodology.

### Meta movers

Movers sit at the bottom of `/tier-list` rather than on the news page, because they are
this table seen over time: `getMetaMovers` reads the same `brawler_stats` rows, re-centres
them with the same `normalizeWinRate`, and applies the same sample floor.

**Movement is measured on the meta score, not on win rate.** The tiers are assigned from
the score, so ranking movers on win rate alone let the two disagree — a brawler whose win
rate held while its pick rate collapsed is sliding down the page without ever appearing
here. The row shows the score change as the headline, both inputs beneath it, and the tier
transition when the move crossed a boundary.

**Snapshots computed under different methodologies are never compared.** The baseline is a
one-number summary of what was measured, and a large jump in it means the pipeline changed
rather than the meta. This is not hypothetical: when win rates moved to competitive-only
battles the sample baseline fell from 72.8% to 53.7% overnight, and because `getMetaMovers`
falls back to the oldest snapshot available when the full lookback is missing, it was
comparing straight across that change. Re-centring cancels the mean shift but not the shift
in *what is being counted*, so brawlers appeared to move by up to 14 points of win rate
where matched snapshots differ by at most 3. Candidate snapshots whose baseline sits more
than 8 points from the latest are now skipped.

It does **not** follow the window and mode controls above it, and the caption says so.
Those recompute rates live from `battle_daily_stats` over a trailing window; movers compare two
stored daily snapshots, which are written at a fixed 7-day window and have no mode
dimension. The caption also reports the span it actually used rather than assuming seven
days.

### Why so much of the roster is unrated

Win rates are computed from competitive Ranked battles only, and those are a small slice of
what gets sampled — roughly **17%** of rows, with the trophy ladder making up most of the
rest. Over a 7-day window that leaves ~5,000 decided battles spread across ~106 brawlers: a
median of about 20 per brawler, which is exactly the floor. So roughly half the roster sits
at or below the line, and the `Not enough Ranked data` section lists each one's progress
toward it rather than a bare count.

Widening the window barely helps yet (30 days yields 5,269 decided battles against 4,998
for 7) because sampling only scaled up recently. It is a pool-size problem, not a window
problem: the fix is more sampled players per run, and history.

### Ranked maps: a per-map split makes the sample tiny

`/ranked` runs the same idea one level down, and that level is where the numbers get
thin. Only competitive battles count (`soloRanked`/`teamRanked`, never the trophy
ladder), and the map name is recorded per battle sample, so the page can only see
battles collected after that column existed. Splitting those across ~27 maps and ~100
brawlers leaves each brawler four to nine decided battles on a given map.

Two things follow, and getting either wrong produces confident nonsense:

- **The baseline is sample-wide, not per-map.** Ranked matchmaking is symmetric, so the
  true average win rate is the same on every map — a per-map figure computed from forty
  battles is measuring our sampling, not the map. Measured on a live window, per-map
  averages ranged from **27% to 71%** while the sample as a whole sat at **53.6%** over
  5,231 decided battles. Scoring against the per-map number meant subtracting noise: on
  a map whose sample happened to read 27%, a brawler losing two games in three cleared
  the bar and got published as that map's best pick.
- **The prior is the brawler, not the population.** Shrinking five battles toward the
  population mean discards the most informative thing available — how that brawler does
  in Ranked generally. So the estimate is hierarchical: the brawler's overall ranked
  record is shrunk toward the sample baseline, and its handful of battles on the map are
  shrunk toward *that*. A brawler has to beat its own form here to rise above itself, and
  the card shows the gap (`+1.4 vs usual`) so the map-specific part of the claim is
  visible rather than implied.

A pick is published only if it lands above the baseline. Maps where nothing clears it
say so instead of ranking noise — currently about a fifth of them — and every card
carries its sample size, distinct brawlers seen, and a `thin sample` / `building` /
`well sampled` label. As the sampler accumulates map-tagged battles the priors matter
less and the maps speak for themselves.

## Release notes

Supercell publishes one post per update at a predictable URL
(`/blog/release-notes/release-notes-<month>-<year>/`) with no index endpoint, so
`src/lib/release-notes.ts` walks backwards from the current month until one responds — up
to 14 months. When September's notes ship, the September URL starts returning 200 and the
page follows automatically with no code change.

The body is Contentful rich text inside the page's `__NEXT_DATA__` payload, parsed into a
small typed tree (paragraphs, headings, lists, bold/italic/underline) and rendered with a
sticky table of contents. Unknown node types are unwrapped rather than dropped, so new
block types still surface their text.

## News page: what it can and cannot know

Supercell publishes announcement posts, but there is no patch-notes, changelog or balance
API to mirror. So the detected-changes half of `/news` is built from data we collect ourselves:

**Detected game changes.** The cron job snapshots the official brawler catalogue daily into
`brawler_catalog_entries` and diffs consecutive days. That reliably catches new brawlers and
new or removed star powers, gadgets, gears and hypercharges — these are real ids appearing
in the API, not a scrape.

It **cannot** detect balance tuning. Damage, health, reload and range are not exposed by the
API at all, so a pure number change is invisible here. The page says so directly rather than
implying it is a full changelog.

The first cron run only seeds the catalogue baseline — recording all ~106 existing brawlers
as "new" would be noise. Changes appear from the second run onwards.

## Icons

| Asset | Source |
| --- | --- |
| Brawlers, star powers, gadgets, gears, ranked tiers, prestiges, club badges, profile icons, maps, game modes | [Brawlify CDN](https://github.com/Brawlify/CDN) |
| Hypercharge, buffie, coins, power points | `public/icons/*` — the CDN does not publish these |
| Trophy | Inline SVG in `src/components/game-icons.tsx` — no standalone asset exists |

`game-icons.tsx` is the single place these are wired up. Star power, gadget and gear use a
representative CDN asset as the generic category mark.

## Popular builds

Brawler pages show unlock rates for each star power, gadget and gear, with real artwork
from the CDN.

Percentages are unlock rates: the share of tracked owners of that brawler who have the
option unlocked.

> **Denominators only count rows that actually recorded abilities.** Snapshots written
> before the ability columns existed have `NULL` arrays, and counting those as
> "owns nothing" put ~440 phantom rows behind every Shelly percentage — dragging a true 98%
> unlock rate down to 16%. `NULL` means *not recorded*, not *owns nothing*, so each kind's
> denominator counts only rows where its column is populated.
>
> The API never reports which option a player has **equipped**, only what they own, and
> invested players unlock everything. So star powers and gadgets land near 97–99% for every
> option — an honest "players take both" rather than a preference. **Gears are where the
> signal lives**, because players buy a couple out of six or seven: a real spread is
> 74 / 64 / 56 / 27 / 16 / 11%. The "Most picked" badge only appears when the leader is
> more than 10 points clear.

## Storage

The database is a free Neon instance: **512 MB of data** (`neon.max_cluster_size`, the limit
that actually refuses writes) and a **0.5 GB plan allowance** that counts data *plus*
retained WAL history. Those are two different numbers and it is easy to chase the wrong one
— `pg_database_size` cannot see history at all, so the console can read 98% while Postgres
reports 300 MB.

### Raw rows are staging, not data

Every read of `battle_samples` and `battle_team_samples` is a `GROUP BY` or a `COUNT`; none
opens an individual row. So the long windows the site reads come from daily roll-ups, and
the raw tables live just long enough to be folded into them:

| Table | Grain | Kept |
| --- | --- | --- |
| `battle_samples`, `battle_team_samples` | one row per battle | 3 days |
| `battle_daily_stats` | day × type × mode × map × brawler × result | 30 days |
| `player_battle_daily` | day × player × brawler | 22 days |
| `brawler_pair_daily` | day × brawler × opponent × side × result | 22 days |
| `brawler_team_daily` | day × brawler (the pairing baseline) | 22 days |
| `player_brawler_snapshots` | day × player × brawler | 2 days |

The old 24-day raw window was sized for a sampling rate that had since quadrupled, and
projected to ~990 MB against a 512 MB ceiling. Pruning harder could not fix it: 21 days is
what the per-map ranked tier list reads, so the window could not shrink without cutting the
feature. On real data the roll-up is 6.5× fewer rows and far narrower ones.

Two invariants hold this together, and both are easy to break by accident:

- **The prune deletes a raw day only if it exists in the roll-up.** The game API serves a
  player's last ~25 battles and has no history endpoint, so a run that sampled but failed to
  fold must not be allowed to delete its own evidence. The flip side is that a persistently
  failing roll-up parks the prune while the sampler keeps writing — which is why a fold
  failure forces run status to `partial` and the workflow fails on it.
- **`RAW_BATTLE_RETENTION_DAYS` must not drop below `ROLLUP_REBUILD_DAYS`.** The prune cuts
  at a 72-hour timestamp while the fold rebuilds whole dates, so the oldest day in raw is
  always partially pruned. That is safe only because it sits outside the rebuild window. If
  those cross, a partially-pruned day gets refolded from what survived and is silently
  undercounted forever.

### The pressure valve

Above 80% of the data budget the prune shortens its windows rather than waiting to be
noticed; above 93% it spends more. Cheapest loss first: snapshots (one day already contains
the whole pool), then the pairing roll-ups, then `battle_daily_stats` last because cutting
it to 21 days costs the tier list's 30-day option. The raw window is never touched — trading
an unrecoverable loss for a few megabytes is not a trade worth making.

It defends early on purpose. **Deleting rows does not shrink a Postgres table**: `DELETE`
frees pages inside the file for reuse, which stops growth, but the file only shrinks under
`VACUUM FULL`, which needs free space to copy into. Measured once: pruning 240k rows moved
the reported size from 464 MB to 464 MB, and the rewrite that followed took it to 270 MB. A
valve that waits until the disk is nearly full cannot save anything.

`npm run db:storage` reports table sizes, reclaimable space and (with `NEON_API_KEY` set)
Neon's own billed figures. `-- --reclaim` rebuilds bloated tables and indexes; it takes an
exclusive lock, so it is opt-in and not something the cron does.

## Cron budget

Vercel's Hobby plan caps an invocation at 300s (both the default and the maximum), and the
run does real work against a remote database, so two things matter:

- **Writes are batched.** Recomputing stats with per-row upserts meant ~1,200 sequential
  round trips and took 112s. Delete-then-`createMany` is two round trips per table and
  brought the same run to 22s.
- **The ranking pass is time-boxed and resumable.** It costs ~106 API calls, refreshes only
  brawlers not already done today, and stops at its budget — whatever does not fit is
  picked up next run, so a timeout can never leave the cache permanently half-built.

### Tuning

- Batch size: `POST /api/cron/refresh-stats?batch=200` (1–500, default 100). This is a
  ceiling, not a target: `RUN_BUDGET_MS` stops sampling first, so an over-large batch costs
  nothing beyond a shorter ranking pass.
- Run budget, ranking floor and recompute reserve: `RUN_BUDGET_MS`,
  `RANKING_MIN_BUDGET_MS` and `RECOMPUTE_RESERVE_MS` in `src/lib/aggregation.ts`. Keep
  `RUN_BUDGET_MS` meaningfully below the route's `maxDuration`; overshooting returns a 504
  and Vercel never retries a cron, so the slot is simply lost.
- Window, concurrency, pool target and retry count: constants at the top of
  `src/lib/aggregation.ts`. Retention and the storage valve live there too —
  `ROLLUP_RETENTION_DAYS`, `PAIRING_ROLLUP_RETENTION_DAYS`, `SNAPSHOT_RETENTION_DAYS`,
  `STORAGE_HIGH_WATER` and `STORAGE_CRITICAL`. Raising a retention default without
  re-checking that the projected plateau still sits below the high-water mark turns the
  valve into an oscillator; a test in `storage-pressure.test.ts` guards exactly that. `POOL_TARGET` is deliberately near twice the daily sample rate:
  a battle log only holds ~25 recent battles, so a pool too large to revisit every couple of
  days drops battles between visits.
- Tier thresholds and the sample floor: `src/lib/stats.ts`.

Watch for `partial` runs in `aggregation_runs`, which record why samples failed.

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
prisma/schema.prisma        Neon Postgres schema (raw samples, daily roll-ups, aggregates)
prisma.config.ts            Prisma 7 config — migration datasource
scripts/seed-stats.ts       Fills the sampling pool without a full run
scripts/db-storage.ts       Storage report + opt-in reclaim (npm run db:storage)
src/lib/bs-api.ts           Official API client (server-only, via RoyaleAPI proxy)
src/lib/brawlapi.ts         Keyless artwork/metadata client
src/lib/aggregation.ts      Sampling + aggregation pipeline (write side)
src/lib/catalog.ts          Catalogue snapshot + diff, powering detected changes
src/lib/stats.ts            Tier-list reads, normalisation, tiers, meta movers, read caching
src/lib/progression.ts      Economy table and account-completion maths
src/lib/regions.ts          Full ISO country list for the leaderboard
src/lib/recent-searches.ts  localStorage-backed recent tags (client-only)
src/lib/tags.ts             Tag normalise / validate / encode
src/lib/errors.ts           Shared error vocabulary and user-facing copy
src/types/                  Interfaces for every API response and DB row
```

## Notes

- Icons are [lucide-react](https://lucide.dev) throughout; there are no emoji in the UI.
- Headings and the wordmark use **Lilita One** (`--font-display`), the closest free match
  to the game's heavy rounded display type. Body copy stays on Geist for readability. The
  `display`, `display-hero` and `btn-game` utilities in `globals.css` are what give the UI
  its game feel — use them rather than restyling per component.
- Brawler, map and mode artwork comes from Brawlify's CDN via brawlapi.com metadata.
  `next/image` is configured for those hosts in `next.config.ts` and uses `unoptimized` for
  CDN sprites to avoid burning Vercel's image-optimisation quota on assets that are already
  small and cached.
- The theme is dark-only by design: Brawl Stars artwork is drawn on dark backgrounds.

This material is unofficial and is not endorsed by Supercell. See Supercell's Fan Content
Policy.
