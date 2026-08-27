# Migration runbook — written 2026-08-26

Working notes for moving BrawlZone off Vercel. Delete this file once the move
is done; it is a plan, not documentation.

## Where things stand

**The site is down.** Vercel Hobby paused the project on 2026-08-26 for
exceeding two allowances in one day — Fluid Active CPU 12h3m against 4h, Fast
Origin Transfer 20 GB against 10 GB. Hobby usage tracks the calendar month, so
it **returns on its own ~Sep 1**. That date is the safety net under everything
below: nothing we try can leave the site worse off than it already is.

**The cause is fixed and pushed.** `/draft/[[...state]]` had moved its state
into the path — right for caching, but it turned an unenumerable tool into
~3x10^11 crawlable URLs each linking to ~212 more. Fixed across `801b6a8`,
`ffbda54`, `c91c904`, `66f6a12`: `robots.txt` + an edge guard in `src/proxy.ts`,
both reading `CRAWLER_DISALLOW` from `src/lib/crawl-policy.ts`, pinned by
`crawl-policy.test.ts`. Also fixed: the home page and `/maps` were pinned to
short revalidates by inner fetches (trap 2 in AGENTS.md).

**Verified as of 2026-08-26**, all against a clean build:

| | |
| --- | --- |
| Crawlable surface | 421 URLs link-reachable, ~1,000 with the sitemap; `npm run crawl:budget` terminates |
| Caching | all 18 routes: declared `revalidate` == served `s-maxage` |
| Monthly ceiling | ~4.6 GB transfer (46% of Hobby), ~280K ISR writes (140%, a loose bound) |
| Sampler | healthy, ran right through the outage, data current |
| Database | 94 MB of Supabase's 500 MB, growing ~45 MB/day since the Aug 25 rebuild |

## The decision

Move the **web tier only** to a **Hetzner CAX21** (4 vCPU Ampere ARM, 8 GB,
80 GB, ~EUR 8.60/mo with Portuguese VAT). Keep Supabase as the database for now.

Why this and not the alternatives:

- **Hetzner over Oracle A1 (for now).** A1 is the preferred destination and the
  poll is still running for it, but `eu-madrid-1` has had no capacity all day
  and there is no ETA. Hetzner is available immediately.
- **Hetzner over Vercel Pro.** Pro is ~EUR 18 for one month and fixes it in two
  minutes with no work — a legitimate choice if the evening isn't worth it. But
  Hetzner is cheaper, ends the same outage, and is the box we want anyway.
- **Hetzner over Railway.** Railway is usage-billed with no hard cap. The owner
  has been explicit: he would rather the site pause than receive an unexpected
  charge. A fixed monthly price is the requirement, not a preference.
- **CAX21 over CAX11.** `next build` runs on the box (the dev machine is x86,
  both targets are ARM, so cross-building via QEMU is not worth it). 8 GB means
  the build never OOMs. CAX11 at ~EUR 5.40 works with swap.
- **Keep Supabase.** Fastest path back online, database untouched so rollback
  is a DNS change, and it avoids migrating Postgres twice if A1 later appears.

**Do not** propose any of these again without new information: Oracle PAYG
(declined — no hard spend cap), an E2.1.Micro (1 GB, x86, wrong architecture to
rehearse on), moving to MySQL HeatWave or Autonomous DB (Prisma has no Oracle
connector; MySQL means rewriting the Postgres arrays and `unnest`).

## Plan

**Phase 1 — owner.** Hetzner account, CAX21, Ubuntu 24.04, paste
`~/.ssh/id_ed25519.pub`. Hand over the IP.

**Phase 2 — write the setup.** None of this exists yet:

- `output: 'standalone'` in `next.config.ts`
- `Dockerfile`, multi-stage, arm64, Node 24
- `compose.yml` — app + Caddy. **`.next/cache` must be on a named volume**, or
  every container restart re-renders all ~1,000 URLs on first hit.
- `Caddyfile` — automatic TLS for brawlzone.net
- `deploy.sh` — `git pull && docker compose up -d --build` on the box
- env: `BRAWL_STARS_API_KEY`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
  `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`

**Phase 3 — verify before DNS.** On the raw IP, with the site still publicly
down and nothing at risk: walk the routes, confirm Supabase reads and the
RoyaleAPI proxy work, check `/robots.txt` and the edge guard (Googlebot UA must
get 404 on `/draft/<state>` and `/player/<tag>`, Discordbot must get 200 on
`/player/<tag>`), then run `npm run crawl:budget` against it and confirm 421.

**Phase 4 — cut over.** Point `brawlzone.net` at the box. Leave the Vercel
project alone as a fallback; Sep 1 restores it regardless.

**Later, deliberately, not part of this:** Postgres onto the box (this is what
removes the 500 MB ceiling and the whole `pressureFor()` constraint), Cloudflare
in front, replacing `@vercel/analytics` — its one import in `src/app/layout.tsx`
is the only Vercel coupling in the codebase.

## Oracle A1, still running in the background

A systemd user service polls for Always Free A1 capacity and will keep doing so
across reboots.

- `~/a1-grab.sh`, service `a1-grab` (`systemctl --user status a1-grab`), log
  `~/a1.log`, linger enabled
- Shapes tried best-first each round: `2:12 1:6 1:3`. The tenancy limit is
  **2 OCPU / 12 GB**, not the advertised 4/24 — asking for more fails with
  `LimitExceeded` every time.
- `eu-madrid-1` has **one availability domain**, so there is nowhere else to try
- 71 no-capacity attempts on 2026-08-26 between 10:02 and 16:53, zero hits
- On success it writes `~/.a1-launched`; `~/.a1-notify.sh` (wired into
  `.bashrc`) raises a Windows dialog. A systemd service cannot reach WSL
  interop, which is why the notification is split out this way.
- A duplicate-launch guard stops it creating a second instance
- Decision point: if still dry at end of September, Madrid is structurally full

If A1 does land, the Phase 2 files move across unchanged — both boxes are
Ampere ARM. That migration is provision, same compose, restore a dump, DNS.

## Still owed on Sep 1

Whatever happens with Hetzner: when Vercel un-pauses, **confirm `66f6a12` is the
live production deployment** before crawlers pick up again. It was pushed while
the project was paused and may never have built. Serving the pre-fix build even
briefly restarts the whole problem — edge requests climbed 871K to 954K while
the site was dark, so the crawl queue is still hot.

## Gotchas already paid for

- `next start` renames its process to `next-server`. `pkill -f "next start"`
  misses it, the new server dies on `EADDRINUSE`, and you measure a stale build.
  **Kill by port.** This produced three contradictory readings before anyone
  noticed.
- `pkill -f <pattern>` matches the invoking shell when the pattern appears
  anywhere in its own command line. Cost three killed shells today.
- Scripts importing `lib/` need `--conditions=react-server`; no top-level
  `await` (tsx compiles to CommonJS here). Both in AGENTS.md.
