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
  echo "Caddyfile changed, reloading caddy"
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
fi
docker image prune -f >/dev/null
# Build cache, not just dangling images. Measured 2026-08-27: 11.77 GB of it,
# a quarter of the disk, because every deploy rebuilds and image pruning does
# not touch build cache at all. Keep a week so ordinary redeploys still hit
# warm layers and a rebuild stays ~2 minutes.
docker builder prune -f --filter until=168h >/dev/null
echo "done: $(git log --oneline -1)"
