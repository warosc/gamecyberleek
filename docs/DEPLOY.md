# Production deploy

Live: **http://66.70.188.137:8090** (VPS `vps-bad2f38f`, Debian 12, Docker). The same VPS runs
another application on ports 80/443 (`opticaleyepro`); the game never touches those ports.

## Release and deploy

```sh
node scripts/release.mjs
SSH_KEY=~/.ssh/leek_ops_deploy scripts/deploy-vps.sh debian@66.70.188.137
```

`release.mjs` needs a git-ignored `.env.production`:

```
VITE_DEBUG_GAME=false
VITE_SUPABASE_URL=https://tawimigwbpwtwwkeaglg.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
```

It refuses to pack a bundle that still has the debug keys or lacks the online settings, and it
validates `nginx.conf` in Docker. The deploy key `~/.ssh/leek_ops_deploy` is authorised for
`debian` on the VPS, so no password is needed.

On the server each release is in `~/leek-ops-releases/releases/<name>/`, and
`~/leek-ops-releases/current` points at the live one. The container is `leek-ops-game`
(compose project `leek-ops`) on port 8090. `curl http://66.70.188.137:8090/release.json` shows
the live commit.

## Rollback

```sh
ssh -i ~/.ssh/leek_ops_deploy debian@66.70.188.137
ls -dt ~/leek-ops-releases/releases/*/          # newest first
sh ~/leek-ops-releases/releases/<previous>/vps-install.sh
```

The build that ran before 0.2.0 is kept as the image `leek-ops-game:pre-v0.2-backup`.

## Open items

- **HTTPS**: needs a domain pointed at the VPS and a TLS proxy in front of port 8090. Port
  443 belongs to the other application's Apache, so this means either a virtual host there or
  a separate domain/port. Without HTTPS the game plays normally but browsers will not install it
  as an app or run its offline cache.
- **Disk**: the root disk was at 94% on 2026-09-25. About 30 old `leek-ops-game` image tags
  and old `cyberleek-*-deploy.tgz` files in `/home/debian` can be removed to free space.
