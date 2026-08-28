#!/usr/bin/env bash
# Nightly logical backup of the local Postgres.
#
# Dumps from inside the container, so it needs no exposed port and no client
# on the host. Keeps 7 daily + 4 weekly (Sundays) copies.
#
# WARNING: these live on the same disk as the database. That defends against
# operator error -- a bad migration, a wrong DELETE -- but NOT against losing
# the box. An off-box copy is still owed.
set -euo pipefail

DIR="$HOME/backups"
mkdir -p "$DIR"
cd "$HOME/brawlstats"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
out="$DIR/brawlzone-$stamp.sql.gz"

docker compose exec -T db pg_dump -U brawlzone -d brawlzone \
  --no-owner --no-privileges | gzip -9 > "$out.tmp"

# Only promote a dump that gunzips cleanly and carries the tables we expect.
# A truncated dump that silently replaces a good one is worse than no backup.
tables=$(gunzip -c "$out.tmp" | grep -c "^CREATE TABLE" || true)
if [ "$tables" -lt 17 ]; then
  echo "REFUSING: dump has $tables tables, expected >= 17" >&2
  rm -f "$out.tmp"
  exit 1
fi
mv "$out.tmp" "$out"
echo "wrote $out ($(du -h "$out" | cut -f1), $tables tables)"

# The analytics database too. Smaller and less precious than the site data --
# losing it costs history, not the site -- but restoring only one of the two
# would leave the tracking script in layout.tsx pointing at a website record
# that no longer exists, and every page view would be dropped silently.
uout="$DIR/umami-$stamp.sql.gz"
if docker compose exec -T db pg_dump -U brawlzone -d umami --no-owner --no-privileges 2>/dev/null | gzip -9 > "$uout.tmp"; then
  if gunzip -t "$uout.tmp" 2>/dev/null; then
    mv "$uout.tmp" "$uout"
    echo "wrote $uout ($(du -h "$uout" | cut -f1))"
  else
    rm -f "$uout.tmp"
    echo "analytics dump was corrupt, discarded" >&2
  fi
else
  rm -f "$uout.tmp"
  echo "analytics dump failed (is the umami database present?)" >&2
fi

# Keep 7 most recent; plus any Sunday dump from the last 28 days.
cd "$DIR"
ls -1t umami-*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
ls -1t brawlzone-*.sql.gz 2>/dev/null | tail -n +8 | while read -r f; do
  d=$(echo "$f" | grep -oP '\d{8}')
  if [ "$(date -d "$d" +%u 2>/dev/null)" = "7" ] && \
     [ "$d" -ge "$(date -u -d "28 days ago" +%Y%m%d)" ]; then
    continue
  fi
  rm -f "$f"
done
echo "retained: $(ls -1 brawlzone-*.sql.gz 2>/dev/null | wc -l) dumps, $(du -sh . | cut -f1)"
