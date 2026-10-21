# LEEK OPS online backend

The SQL in `migrations/` is the whole online backend: the daily leaderboard, the live daily board,
run tickets and cloud saves. It started on a Supabase project (hence the folder name), which went
away in October 2026; since then it runs on our own VPS as Postgres + PostgREST
(`server/docker-compose.online.yml`), and the game's nginx forwards the same-origin `/api/rpc/` to
it. See `server/README.md` for operating it.

The game plays fully offline. Built with `VITE_ONLINE_URL=/api` it adds the online features; with
it empty it never touches the network.

## Database setup

Migrations in `migrations/`, applied in order:

| Migration | Applied | What it does |
|---|---|---|
| `0001_leek_ops_online.sql` | 2026-09-25 | Tables, RLS, cloud saves, daily board |
| `0002_run_scoring_and_guards.sql` | 2026-09-25 | Server-side scoring, implausible-run checks, stale-save guard (409), per-IP limit on new operatives, 429 rate limits |
| `0003_run_tickets_and_private_codes.sql` | VPS | Daily results need a ticket issued at run start (one use, run time must fit in real time since issue); kill and level ceilings from the live board; cloud saves never store the operative code |
| `0004_self_hosted_client_ip.sql` | VPS | Client IP from nginx's `X-Client-Ip` only, stored as an HMAC under a secret salt; IPv6 grouped by /64 |
| `0005_live_board.sql` | VPS | Live daily board validated by the server (presence clock, score ceiling), replacing Realtime |

0001 and 0002 dates are when they went onto the old Supabase project. On the VPS all of them are
applied in order by `server/migrate.sh`, which every deploy runs and which records each file in
`schema_migrations`, so a migration is applied exactly once.

Tables are closed to the `anon` role PostgREST uses; only these functions are callable:

| Function | Purpose |
|---|---|
| `leek_start_daily_run(code, day)` | Issues the ticket a daily run's result must carry; at most 60 per code per hour |
| `leek_submit_daily_run(ticket, code, callsign, day, kills, level, duration_ms, victory)` | Accepts each ticket once, for its own code and day, if the run time fits in the real time since the ticket; scores the run on the server (same formula as the client), rejects impossible runs (a win before 4:00, more than 40 + 3 kills per second, a level those kills cannot reach) and keeps the best per operative per day |
| `leek_daily_board(day, limit)` | Top scores for a day (callsign and score) |
| `leek_put_save(code, callsign, profile)` | Stores the cloud save; **409** if the stored save has more completed runs |
| `leek_get_save(code)` / `leek_save_info(code)` | The save, or just its run count and time |
| `leek_live_update(day, key, callsign, score, seconds)` / `leek_live_board(day, key)` | Live daily board: report and read who is playing right now |

Writes are limited to one score and one save per 3 s per code (**429**), and to 20 new codes
per client IP per hour; only a hash of the IP is stored.

## Live daily board

During an online daily run each client reports `{ callsign, score, run time }` under a random
per-run key (never the operative code) at most every 1.5 s, and reads the board every 2.5 s. The
server refuses a new key claiming more than 30 s of run time, run time that advances faster than
real time, and scores above the live ceiling for that run time, so fakes cannot show up on anyone's
board. Rows drop off 20 s after their last report. The persisted board always comes from
`leek_submit_daily_run`.

## Identity

There are no accounts. Each device generates an **operative code** (`XXXX-XXXX-XXXX-XXXX`, 16
symbols without I/O/0/1, about 80 bits). The server stores only its SHA-256 hash. The code is
the key to the cloud save: typing it on another device restores the save there (**NUBE** in
Settings). Callsigns are public and limited to 3–16 characters (A–Z, 0–9, `-`).

The game runs in the browser, so no leaderboard can be fully cheat-proof; server-side scoring,
plausibility checks and rate limits make abuse slow and easy to clean up
(`delete from daily_scores where …` with psql in the `leek-ops-db` container).
