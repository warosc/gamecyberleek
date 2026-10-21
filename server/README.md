# Online backend (VPS)

Postgres 15 and PostgREST, defined in `docker-compose.online.yml`, serving the SQL functions in
`supabase/migrations/` to the game at the same-origin path `/online/rpc/<function>`.

```
browser ── :8090 or Cloudflare tunnel ──> leek-ops-game (nginx) ──/online/rpc/──> leek-ops-api (PostgREST)
                                                                                    │ role anon
                                                                              leek-ops-db (Postgres)
```

- Nothing is published on the host. The three containers share the Docker network `leek-ops-net`.
- nginx only forwards `POST /online/rpc/*`, rate-limits by client IP (5 r/s, burst 20), drops every
  forwarding header the client sent and sets `X-Client-Ip` itself. It trusts Cloudflare's
  `Cf-Connecting-Ip` only for requests that reach it from the Docker gateway, which is where the
  tunnel's traffic comes from.
- PostgREST connects as `authenticator` and switches to `anon`, which can execute the granted
  functions and nothing else. Its OpenAPI description is disabled.

## Secrets

`~/leek-ops-online/.env` on the server, created once and never committed:

```
POSTGRES_PASSWORD=<random hex>
AUTHENTICATOR_PASSWORD=<random hex>
```

Without that file a deploy skips the backend and the game runs offline. `init/00-roles.sh` reads
`AUTHENTICATOR_PASSWORD` only when the database volume is first created; changing it later means
`alter role authenticator password '…'` as well.

## Deploys and migrations

`scripts/vps-install.sh` (run by every deploy) creates `leek-ops-net` if needed, brings this
compose project up and runs `migrate.sh`, which applies each `migrations/*.sql` not yet recorded in
`schema_migrations`, one transaction per file. Migrations only move forward: rolling the game back
keeps the newer database.

## Operating it

```sh
docker exec -it leek-ops-db psql -U postgres -d leek         # SQL shell
docker logs --tail 50 leek-ops-api                           # API errors
docker exec leek-ops-db psql -U postgres -d leek -c "delete from daily_scores where …"   # moderation
```

Backups: `backup-leek-ops.timer` dumps the database daily to `/home/debian/backups/leek-ops/`
(30 days kept), next to the clinic's backups.
