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
set -uo pipefail

cd "$HOME/brawlstats" || exit 1

git fetch --quiet origin main || exit 0

local=$(git rev-parse HEAD)
remote=$(git rev-parse origin/main)
[ "$local" = "$remote" ] && exit 0

changed=$(git diff --name-only "$local" "$remote" | wc -l)
echo "Deploying ${local:0:7} -> ${remote:0:7} ($changed file(s) changed)"
caddy_changed=$(git diff --name-only "$local" "$remote" | grep -cx "caddy/Caddyfile" || true)

git reset --hard --quiet origin/main

build=$(mktemp); trap 'rm -f "$build"' EXIT
start=$(date +%s)
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
