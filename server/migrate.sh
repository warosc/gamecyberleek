#!/bin/sh
# Applies the SQL migrations shipped with a release, in order and once each, to leek-ops-db.
# Each file runs in one transaction together with its schema_migrations row, so a failure leaves
# nothing half applied and the next deploy retries it.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
migrations="$here/../migrations"
db="docker exec leek-ops-db psql -U postgres -d leek -v ON_ERROR_STOP=1"

ready=no
for attempt in $(seq 1 30); do
  if docker exec leek-ops-db pg_isready -U postgres -d leek >/dev/null 2>&1; then ready=yes; break; fi
  sleep 2
done
[ "$ready" = yes ] || { echo "leek-ops-db is not accepting connections" >&2; exit 1; }

for file in "$migrations"/*.sql; do
  name=$(basename "$file")
  if [ "$($db -tAc "select 1 from schema_migrations where name = '$name'")" = 1 ]; then continue; fi
  echo "applying $name"
  { cat "$file"; printf "\ninsert into schema_migrations (name) values ('%s');\n" "$name"; } \
    | docker exec -i leek-ops-db psql -U postgres -d leek -v ON_ERROR_STOP=1 --single-transaction -q
done
