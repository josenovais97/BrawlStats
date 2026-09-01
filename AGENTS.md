<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Operations: where this actually runs

Written 2026-08-25 after the free tiers on both Vercel and the database were
breached in the same week; rewritten 2026-08-27 when everything moved onto one
box. If you are picking this project up, read this before changing anything
about caching, sampling or retention — most of it is counter-intuitive and was
learned expensively.

## The stack

| | |
| --- | --- |
| Host | **Oracle Cloud Always Free**, VM.Standard.A1.Flex (2 OCPU / 12 GB, aarch64), `eu-frankfurt-1` |
| Serving | Docker Compose — Caddy (TLS) -> Next standalone -> Postgres, all on the box |
| Database | **Postgres 17, on the box**, container-only with no published port except loopback |
| Sampler | **systemd timer on the box**, `brawlzone-sampler`, every 2h at :17 |
| Deploys | **systemd timer**, `brawlzone-deploy`, every 5 min: resets to `origin/main` and rebuilds if HEAD moved |
| Backups | **systemd timer**, `brawlzone-backup`, nightly 03:30 UTC, 7 daily + 4 weekly |
| Backup proof | **systemd timer**, `brawlzone-verify-restore`, Mondays 04:30 UTC, restores into a scratch database |
| DNS | Cloudflare, A records **DNS-only (grey cloud)** for apex and `www` |

The box is a mirror of `origin/main` — the deploy timer resets to it, so **never
edit files on the box**; they are silently wiped on the next cycle. The one
exception is `.env.production`, which is untracked and therefore survives.

Superseded, in order: Vercel Hobby (paused 2026-08-26 for CPU and origin
transfer — see trap 5), Neon (5 GB/month egress cap suspended it mid-cycle),
Supabase (500 MB, and its direct connection is IPv6-only so everything had to
go through the pooler). Vercel and Supabase both still exist untouched as
fallbacks; DNS no longer points at either.

## What moving off a PaaS actually changed

**Backups are yours now.** Supabase did them invisibly. `~/backup-db.sh` dumps
from inside the container and refuses to promote a dump with fewer than 17
tables — but that is a check on the *file*, not on whether the SQL inside it
replays. `brawlzone-verify-restore` closes that gap weekly: it restores the
newest dump into a scratch database beside the live one and asserts the result
is something the site would accept — table count matching live, rows in the
tables the site cannot render without, and a newest battle day under three days
old. It refuses to run without 4 GB free, and drops the scratch database on
every exit path. A first real run took 13s for 17 tables and 369 MB.

The dumps still sit on the same disk as the database, so on their own they
defend against operator error but not against losing the box. A
`brawlzone-pull-backup` user timer on the workstation copies them off nightly
at 09:00, so that debt is paid — but it lives on the workstation, not here, and
nothing on the box would notice if it stopped.

**Storage stopped being someone else's plan limit.** `STORAGE_LIMIT_BYTES` is
now 8 GB, a slice of the 45 GB volume rather than a free tier, and is ~50x the
measured plateau. Raising it did not lengthen retention: the `ok` row of
`RETENTION_UNDER_PRESSURE` bounds history, and the valve is idle at ~100 MB.

**Docker build cache is not covered by `docker image prune`.** It reached
11.77 GB — a quarter of the disk — in a single day of rebuilds before anyone
looked. `auto-deploy.sh` now runs `docker builder prune --filter until=168h`.

**Oracle reclaims idle Always Free instances.** If CPU 95th percentile, network
*and* memory all sit under 20% across a continuous 7-day window, the instance
can be stopped. This box idles near zero load and ~13% memory, so it is inside
that window. Nothing on the box is reproducible from the repo alone —
`.env.production` and every dump live only there.

## Six traps that cost real outages

**1. `revalidate` does nothing without `generateStaticParams`.** A dynamic route
that exports `revalidate` but no `generateStaticParams` is *not* ISR — Next
re-renders it per request and the build marks it `ƒ`. Returning an empty array
is what the framework documents as "all paths at runtime". This one line left
~950 indexable URLs re-rendering against the database on every crawler hit, and
was the root cause of a 168% origin-transfer overage.

**2. A route's revalidate is the shortest cache *inside* it.** Declaring
`revalidate = 43200` achieves nothing if the page calls an `unstable_cache` with
a 1-hour TTL, or a `fetch` with `next: { revalidate: 120 }`. Three separate
routes were silently pinned this way — `/brawlers/[slug]` declared 6 hours and
ran at **120 seconds** because one ranking call used the default. **The build
output prints the effective number; the declaration is not evidence.** For ISR
routes the table shows no value, so read `s-maxage` off a running server.

Since then, three more. `/maps` declared 86400 and served 3600. The home page
declared *nothing* — which is not "never revalidate" but "inherit the shortest
fetch inside me" — and served 120 from two separate defaults, so fixing one
changed nothing because the other still set the floor. Fix every one of them,
then re-measure; one page can have more than one.

When you re-measure, kill the old server **by port**. `next start` renames its
process to `next-server`, so `pkill -f "next start"` silently misses it, the new
server dies on `EADDRINUSE`, and you read the previous build's headers while
believing you rebuilt.

**3. Scripts importing `lib/` need `--conditions=react-server`.** `lib/stats`,
`lib/bs-api` and `lib/prisma` all `import 'server-only'`, which throws outside a
server bundle. The condition resolves it to an empty module. `npm test` and
`npm run stats:refresh` both set it.

**4. No top-level `await` in scripts.** There is no `"type": "module"`, so tsx
compiles to CommonJS where top-level `await` is a *parse* error. `tsc --noEmit`,
eslint and `next build` all pass on it because none of them execute the file.

**5. Moving a tool's state from the query string into the path makes it
crawlable.** Query parameters are one URL; path segments are a URL each, and
`next build` prints the same single line for `/draft/[[...state]]` whether that
route addresses one page or 3x10^11. On 2026-08-25 the draft helper made that
move — correctly, since `searchParams` opts a route out of caching — and every
draft page links to every next state, so a crawler found ~27 maps x 1.2M enemy
orderings x 10k ally orderings, each a full render plus an ISR write plus
~200 KB. It exhausted the Hobby plan's Fluid CPU and origin transfer inside a
day and paused the site for the rest of the cycle.

`noindex` is not the fix — a crawler has to fetch the URL to read it, and the
fetch is the whole cost. The fix is `robots.txt`, enforced at the edge by
`src/proxy.ts` for anything that ignores it. Both read `CRAWLER_DISALLOW` in
`lib/crawl-policy`; `crawl-policy.test.ts` fails if the proxy matcher stops
covering a blocked prefix.

**6. Env vars the *build* needs, and their absence failing silently.** Routes
with `revalidate` and no dynamic segment are PRERENDERED during `next build`.
On Vercel the project's env vars were present at build time, so this coupling
was invisible; in Docker they were not, and the first images shipped with
"Not enough data" baked into both tier lists and "BRAWL_STARS_API_KEY is not
set" baked into the leaderboard. The pages returned 200 and the logs were
clean.

`.env.production` is now mounted into the builder as a **BuildKit secret**
(never an `ARG` or `ENV`, so nothing lands in an image layer), and
`BUILD_DATABASE_URL` points at the loopback-published `127.0.0.1:5432` because
a build does not join the compose network.

Two things made this much harder to find than it should have been, both worth
knowing before debugging anything similar:

- **The app image has no `curl` and no `wget`.** An in-container fetch returns
  an empty string, which reads exactly like "the page rendered without data".
  Measure through Caddy from outside instead.
- **`.next/cache` is a named volume and survives rebuilds.** A fixed build
  keeps serving the old broken page until the volume is cleared or `s-maxage`
  expires.

## Limits, and which defend themselves

Storage **self-corrects**: `pressureFor()` in `lib/aggregation` shortens
retention windows at 80% and 93% of `DATA_BUDGET_BYTES`. Every table has a
retention bound — `player_trophy_points` was the last exception and now prunes
at 120 days (charts read 90).

Egress **has no guard**, and since 2026-08-27 it is no longer metered by
anyone — the box has fixed monthly bandwidth rather than a per-GB bill, so the
failure mode changed rather than disappeared. What the crawlable-URL bound
protects now is **CPU**: two shared Ampere cores rendering pages, where the old
Vercel bill has become a saturated box and a slow site.

Page reads are served from ISR plus a 3-hour data cache, so work is driven by
the sampler's fixed 8 runs/day and does *not* scale with visitors. That is
reasoning, not a measurement. If the box starts working hard, the first thing
to check is whether something started reading uncached.

That reasoning has one load-bearing assumption, and trap 5 is what happens when
it quietly stops holding: egress does not scale with visitors, but it scales
with the number of *distinct URLs* a crawler can reach, and nothing about
adding a route makes that number visible. So it is now measured rather than
argued. `npm run crawl:budget` walks the site the way a crawler does — same
origin, `<a href>` only, obeying `robots.txt` and `rel="nofollow"` — and prints
the reachable set per section, currently **421 URLs** link-reachable and ~1,000
counting the sitemap. It exits non-zero if the walk does not terminate.

**Run it against a local `next start` after adding any route with a dynamic
segment**, and check the new route's count is a number you can explain. The
answer to "is this bounded?" is the output of that command, not an argument.

**Do not raise sampling frequency, pool size, or any retention window without
re-deriving the plateau.** `storage-pressure.test.ts` and
`snapshot-sample.test.ts` pin that arithmetic; they exist to make a careless
change fail loudly.

## Two non-obvious design decisions

**`player_brawler_snapshots` is a sample, not a census.** It records a rotating
quarter of sampled players (`SNAPSHOT_SAMPLE_RATE`), because every consumer is
an aggregate — mean trophies, ability-ownership share, skin popularity — and a
distribution needs a representative sample. At a census it was 47% of the whole
database. The cohort is keyed on `tag + date` so it rotates: keying on `tag`
alone produced *perfectly disjoint* daily cohorts (FNV-1a's low bits are weak,
hence the fmix32 finaliser), which would have measured every aggregate on one
fixed panel forever.

**Sampling frequency is set by the battle log, not by cost.** It holds a
player's last ~25 battles with no history endpoint, so anything played between
visits is lost permanently.

Three hours was that constraint's first answer; two hours is its second.
Measured on the box 2026-08-27 across three days: battles captured per player
per 3h window averaged 12.2, but p95 was 30 and **13.2% of active
player-windows sat at or past 25** -- i.e. one in eight was at the log's
ceiling and losing battles. Halving the interval roughly halves the per-fetch
count. `READ_CACHE_SECONDS` and every `revalidate` that was matched to the
sampler moved with it, because a cache longer than the data's own rhythm serves
stale numbers for no reason.

## What was deliberately not done

- **No egress circuit breaker.** Storage has one; egress does not.
- **The Neon history was never imported.** ~30 MB across three daily-snapshot
  tables. Everything else backfilled itself, because battle logs carry the real
  `battleTime` — a single run recovered 31 days of `battle_daily_stats`. The
  only permanent loss is ~11 days of the release-notes change log.
- **Nothing was moved to a different database engine.** CockroachDB, Turso and
  D1 were all evaluated; D1's 100k writes/day is ~15× under what this project
  writes, and Turso would mean rewriting ~4,500 lines that rely on Postgres
  arrays and `unnest`. No free tier has better egress limits than the 5 GB that
  broke Neon — the fix was to stop needing them, not to shop for a bigger one.
