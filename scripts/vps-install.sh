#!/bin/sh
# Runs on the VPS from inside an extracted release directory:
#   ~/leek-ops-releases/releases/<name>/vps-install.sh
# Brings up the online backend (Postgres + PostgREST) and applies pending migrations when its
# secrets exist, builds the nginx image from the prebuilt dist/, swaps the running container,
# points ~/leek-ops-releases/current at this release, and checks that the site answers. The
# previous release directory is kept, so rolling back is running its vps-install.sh again
# (migrations only move forward; a rollback keeps the newer database).
set -eu
here=$(cd "$(dirname "$0")" && pwd)
base=$(dirname "$(dirname "$here")")
cd "$here"

if docker compose version >/dev/null 2>&1; then compose="docker compose"; else compose="docker-compose"; fi

# The game's nginx joins this network to reach the API, so it must exist even without a backend.
docker network inspect leek-ops-net >/dev/null 2>&1 || docker network create leek-ops-net >/dev/null
secrets="$HOME/leek-ops-online/.env"
if [ -f "$secrets" ]; then
  $compose -f server/docker-compose.online.yml -p leek-ops-online --env-file "$secrets" up -d
  sh server/migrate.sh
else
  echo "No $secrets: skipping the online backend (the game falls back to offline)" >&2
fi

$compose -f docker-compose.vps.yml -p leek-ops build --pull
$compose -f docker-compose.vps.yml -p leek-ops up -d --force-recreate
ln -sfn "$here" "$base/current"

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if wget -q -O /dev/null http://127.0.0.1:8090/release.json 2>/dev/null || curl -fsS -o /dev/null http://127.0.0.1:8090/release.json 2>/dev/null; then
    echo "LEEK OPS is serving $(basename "$here") on port 8090"
    exit 0
  fi
  sleep 2
done
echo "The container started but port 8090 did not answer" >&2
exit 1
