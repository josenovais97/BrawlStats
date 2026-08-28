#!/usr/bin/env bash
# Redeploy when origin/main moves. Run from a systemd timer.
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
git reset --hard --quiet origin/main
docker compose up -d --build

# Caddyfile is a bind mount, so a change to it lands on disk but the running
# Caddy keeps serving the old config -- silently. Reload if it moved in this
# pull. `caddy reload` is graceful: no dropped connections, no restart.
if git diff --name-only "$local" "$remote" | grep -qx Caddyfile; then
  echo "Caddyfile changed, validating and reloading caddy"
  # Validate first, and FAIL if either step fails. A bad Caddyfile makes
  # `caddy reload` decline and keep the previous config -- the site stays up,
  # the change silently does not happen, and without this check the deploy
  # reports success. That is how a crawler block sat in the repo for an hour
  # doing nothing on 2026-08-28.
  if ! docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
    echo "Caddyfile is invalid -- refusing to reload, previous config still serving" >&2
    exit 1
  fi
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || {
    echo "caddy reload failed" >&2
    exit 1
  }
fi
docker image prune -f >/dev/null
# Build cache, not just dangling images. `docker image prune` does not touch
# it at all, and it reached 16.75 GB -- a third of the disk -- inside a day.
#
# Capped by SIZE, not age. An age filter is the wrong tool here: the variable
# is how often this repo is pushed, not how old a layer is, and 19 deploys in
# one day left every layer younger than any sensible cut-off. 4 GB keeps
# same-session rebuilds warm and cannot grow past that however busy the day.
docker builder prune -f --max-used-space=4GB >/dev/null
echo "done: $(git log --oneline -1)"
