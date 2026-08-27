#!/usr/bin/env bash
# Deploy on the box: pull, rebuild, restart. Run from the repo root.
set -euo pipefail

cd "$(dirname "$0")"

[ -f .env.production ] || { echo "no .env.production — copy it from the dev machine first" >&2; exit 1; }

git pull --ff-only
docker compose up -d --build
docker image prune -f

echo
docker compose ps
