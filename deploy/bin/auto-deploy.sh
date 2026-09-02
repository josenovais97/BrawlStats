#!/usr/bin/env bash
# Redeploy when origin/main moves. Run from a systemd timer every 5 minutes.
#
# Resets rather than pulls: this box is a mirror of origin and must never carry
# local edits, or a stray change silently blocks every future deploy. The only
# files that live here and nowhere else are .env.production and .env.umami,
# which are untracked and so survive the reset.
#
# Quiet on success, everything on failure. `docker compose up --build` prints a
# few hundred lines of layer hashes and npm notices; none of it is information
# when the build worked, and all of it is when it did not.
#
# `--force` rebuilds even when HEAD has not moved. That exists for one reason:
# page titles carry the current month ("Best Brock build in Brawl Stars (August
# 2026)"), and those titles are baked into prerendered HTML at build time. With
# no forced path, a month with no pushes would serve last month's date on every
# indexed page — a staleness signal on the exact pages the date was added to
# make look fresh. `brawlzone-refresh.timer` calls this on the 1st.
set -uo pipefail

force=0
[ "${1:-}" = "--force" ] && force=1

cd "$HOME/brawlstats" || exit 1

# Retried within the run, then tolerated across a couple of runs, then fatal.
#
# GitHub intermittently refuses anonymous fetches from this address — measured
# 2026-09-02, two of four back-to-back `ls-remote` calls failed with "could not
# read Username", which is how git reports a 401 when it has no credentials to
# offer. The repository is public and the API rate limit was untouched, so this
# is throttling of the git endpoint, and it outlasts a thirty-second retry.
#
# So a single failed run is not evidence of anything: this timer fires every
# five minutes, and the next tick usually succeeds. What matters is a *streak*.
# Three consecutive failures is a quarter of an hour of not tracking
# origin/main, which is worth an alert; anything less is noise that would train
# the reader to ignore the mail.
#
# The counter is what makes that distinction possible. Before it, this exited 0
# on any fetch error, so it could not tell "nothing new to deploy" from "cannot
# reach the remote" and reported both as success — `OnFailure` never fired, and
# the only thing that noticed was the health check's "box is behind
# origin/main" rule twenty minutes later.
FAIL_STATE="$HOME/.brawlzone-fetch-failures"
FAIL_LIMIT=3

fetched=0
for attempt in 1 2; do
  if git fetch --quiet origin main; then
    fetched=1
    break
  fi
  [ "$attempt" -lt 2 ] && sleep 10
done

if [ "$fetched" -eq 0 ]; then
  streak=$(( $(cat "$FAIL_STATE" 2>/dev/null || echo 0) + 1 ))
  echo "$streak" > "$FAIL_STATE"
  if [ "$streak" -ge "$FAIL_LIMIT" ]; then
    echo "could not fetch origin/main on $streak consecutive runs; the box is no longer tracking it" >&2
    exit 1
  fi
  echo "fetch failed (run $streak of $FAIL_LIMIT before this is treated as an outage); will retry next tick"
  exit 0
fi

rm -f "$FAIL_STATE"

local=$(git rev-parse HEAD)
remote=$(git rev-parse origin/main)
[ "$local" = "$remote" ] && [ "$force" -eq 0 ] && exit 0

if [ "$local" = "$remote" ]; then
  echo "Forced rebuild at ${local:0:7} (no new commits; refreshing dated titles)"
  changed=0
  caddy_changed=0
else
  changed=$(git diff --name-only "$local" "$remote" | wc -l)
  echo "Deploying ${local:0:7} -> ${remote:0:7} ($changed file(s) changed)"
  caddy_changed=$(git diff --name-only "$local" "$remote" | grep -cx "caddy/Caddyfile" || true)
fi

git reset --hard --quiet origin/main

build=$(mktemp); trap 'rm -f "$build"' EXIT
start=$(date +%s)
# Invalidates the build layer only when the month actually turns over, so an
# ordinary same-month deploy still reuses the cache and stays fast.
export BUILD_MONTH="$(date -u +%Y-%m)"
if ! docker compose up -d --build >"$build" 2>&1; then
  echo "Build or restart FAILED. Full output follows:"
  cat "$build"
  exit 1
fi
echo "Built and restarted in $(( $(date +%s) - start ))s: $(docker compose ps --services --status running | tr '\n' ' ')"

if [ "$caddy_changed" -gt 0 ]; then
  # Gate on the EXIT CODE, not on the output. `caddy validate` prints its
  # progress as JSON and never says the word "valid", so grepping its text for
  # one would fail every time.
  #
  # This matters because `caddy reload` DECLINES an invalid config and keeps
  # the previous one running: the site stays up, the change silently does not
  # happen, and without this the deploy still reports success. That is exactly
  # how a stale config served for a day on 2026-08-28.
  chk=$(mktemp)
  if ! docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >"$chk" 2>&1; then
    echo "Caddy config is INVALID -- not reloading, previous config still serving"
    tail -5 "$chk"; rm -f "$chk"; exit 1
  fi
  if ! docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >"$chk" 2>&1; then
    echo "Caddy reload FAILED -- previous config still serving"
    tail -5 "$chk"; rm -f "$chk"; exit 1
  fi
  rm -f "$chk"
  echo "Caddy config reloaded"
fi

# Build cache, not just dangling images. `docker image prune` does not touch it
# at all, and it reached 16.75 GB -- a third of the disk -- inside a day.
#
# Capped by SIZE, not age. An age filter is the wrong tool: the variable is how
# often this repo is pushed, not how old a layer is, and 19 deploys in one day
# left every layer younger than any sensible cut-off.
freed=$(docker image prune -f 2>/dev/null | grep -oP 'Total reclaimed space: \K.*' || echo "0B")
freed_cache=$(docker builder prune -f --max-used-space=4GB 2>/dev/null | grep -oP 'Total:\s*\K.*' || echo "0B")
echo "Reclaimed ${freed} of images and ${freed_cache} of build cache"

echo "Now on $(git log --oneline -1)"
