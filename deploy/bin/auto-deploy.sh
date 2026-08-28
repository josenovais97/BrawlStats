#!/usr/bin/env bash
# Redeploy when origin/main moves. Run from a systemd timer every 5 minutes.
#
# Resets rather than pulls: this box is a mirror of origin and must never carry
# local edits, or a stray change silently blocks every future deploy. The only
# file that lives here and nowhere else is .env.production, which is untracked
# and so survives the reset.
set -uo pipefail

cd "$HOME/brawlstats" || exit 1

git fetch --quiet origin main || exit 0

local=$(git rev-parse HEAD)
remote=$(git rev-parse origin/main)
[ "$local" = "$remote" ] && exit 0

echo "deploying ${local:0:7} -> ${remote:0:7}"
caddy_changed=$(git diff --name-only "$local" "$remote" | grep -cx "caddy/Caddyfile" || true)

git reset --hard --quiet origin/main
docker compose up -d --build

if [ "$caddy_changed" -gt 0 ]; then
  echo "Caddy config changed, validating and reloading"
  # Gate on the EXIT CODE, not on the output. `caddy validate` prints its
  # progress as JSON on stderr and never says the word "valid", so grepping
  # its text for one would fail every time.
  #
  # This matters because `caddy reload` DECLINES an invalid config and keeps
  # the previous one running: the site stays up, the change silently does not
  # happen, and without this the deploy still reports success. That is exactly
  # how a stale config served for a day on 2026-08-28.
  if ! docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/tmp/caddy-check.log 2>&1; then
    echo "Caddy config is INVALID -- not reloading, previous config still serving" >&2
    tail -5 /tmp/caddy-check.log >&2
    exit 1
  fi
  if ! docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/tmp/caddy-check.log 2>&1; then
    echo "Caddy reload FAILED -- previous config still serving" >&2
    tail -5 /tmp/caddy-check.log >&2
    exit 1
  fi
  echo "Caddy reloaded"
fi

docker image prune -f >/dev/null

# Build cache, not just dangling images. `docker image prune` does not touch it
# at all, and it reached 16.75 GB -- a third of the disk -- inside a day.
#
# Capped by SIZE, not age. An age filter is the wrong tool: the variable is how
# often this repo is pushed, not how old a layer is, and 19 deploys in one day
# left every layer younger than any sensible cut-off. 4 GB keeps same-session
# rebuilds warm and cannot grow past that however busy the day.
docker builder prune -f --max-used-space=4GB >/dev/null

echo "done: $(git log --oneline -1)"
