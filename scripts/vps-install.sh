#!/bin/sh
# Runs on the VPS from inside an extracted release directory:
#   /opt/leek-ops/releases/<sha>/vps-install.sh
# Builds the nginx image from the prebuilt dist/, swaps the running container, points
# /opt/leek-ops/current at this release, and checks that the site answers. The previous release
# directory is kept, so rolling back is running its vps-install.sh again.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
base=$(dirname "$(dirname "$here")")
cd "$here"

if docker compose version >/dev/null 2>&1; then compose="docker compose"; else compose="docker-compose"; fi

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
