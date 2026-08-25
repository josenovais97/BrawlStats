<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Operations: where this actually runs

Written 2026-08-25, after the free tiers on both Vercel and the database were
breached in the same week. If you are picking this project up, read this before
changing anything about caching, sampling or retention — most of it is
counter-intuitive and was learned expensively.

## The stack, and what changed

| | |
| --- | --- |
| Host | Vercel, **Hobby** |
| Database | **Supabase** (Postgres 17, `eu-west-2`) — *not Neon, despite older comments* |
| Sampler | **GitHub Actions**, every 3h — *not Vercel Cron; `vercel.json` has no `crons`* |
| Repo | public, so Actions minutes are unmetered |

Neon was abandoned on 2026-08-25 after its 5 GB/month egress cap suspended the
database mid-billing-cycle. The old project may still exist, blocked; it holds
~11 days of history nobody imported. See "What was deliberately not done".

**Supabase's direct connection (`db.<ref>.supabase.co`) is IPv6-only.** Vercel
functions and GitHub runners are IPv4, so it is unreachable from both. Everything
goes through the pooler: session mode (5432) for migrations and the sampler,
transaction mode (6543) for the app.

## Four traps that cost real outages

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

**3. Scripts importing `lib/` need `--conditions=react-server`.** `lib/stats`,
`lib/bs-api` and `lib/prisma` all `import 'server-only'`, which throws outside a
server bundle. The condition resolves it to an empty module. `npm test` and
`npm run stats:refresh` both set it.

**4. No top-level `await` in scripts.** There is no `"type": "module"`, so tsx
compiles to CommonJS where top-level `await` is a *parse* error. `tsc --noEmit`,
eslint and `next build` all pass on it because none of them execute the file.

## Limits, and which defend themselves

Storage **self-corrects**: `pressureFor()` in `lib/aggregation` shortens
retention windows at 80% and 93% of `DATA_BUDGET_BYTES`. Every table has a
retention bound — `player_trophy_points` was the last exception and now prunes
at 120 days (charts read 90).

Egress **has no guard**. It is safe by structure rather than by control: page
reads are served from ISR plus a 3-hour data cache, so egress is driven by the
sampler's fixed 8 runs/day and does *not* scale with visitors. That is reasoning,
not a measurement. If egress climbs, the first thing to check is whether
something started reading uncached.

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
visits is lost permanently. Three hours is that constraint, not a preference.

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
