# LEEK OPS online (Supabase)

Project: `tawimigwbpwtwwkeaglg` — <https://tawimigwbpwtwwkeaglg.supabase.co>

The game plays fully offline. With these two values set at build time it adds the global daily
leaderboard and cloud saves:

```
VITE_SUPABASE_URL=https://tawimigwbpwtwwkeaglg.supabase.co
VITE_SUPABASE_ANON_KEY=<Project Settings → API → anon / publishable key>
```

Put them in `.env` for local development (it is git-ignored) and in the build environment of
the production deploy. The anon key is public by design; never use the `service_role` key here.

## Database setup

Migrations in `migrations/`, applied in order:

| Migration | Applied | What it does |
|---|---|---|
| `0001_leek_ops_online.sql` | 2026-09-25 | Tables, RLS, cloud saves, daily board |
| `0002_run_scoring_and_guards.sql` | 2026-09-25 | Server-side scoring, implausible-run checks, stale-save guard (409), per-IP limit on new operatives, 429 rate limits |

Both were smoke-tested over REST with the publishable key. To apply them elsewhere: SQL
Editor -> paste each file in order -> Run, or the Supabase MCP configured in `.mcp.json`.

Tables are closed by RLS with no policies; the key can only call these functions:

| Function | Purpose |
|---|---|
| `leek_submit_daily_run(code, callsign, day, kills, level, duration_ms, victory)` | Scores the run on the server (same formula as the client), rejects impossible runs (a win before 4:00, more than 8 kills/s, out-of-range level or duration) and keeps the best per operative per day |
| `leek_daily_board(day, limit)` | Top scores for a day (callsign and score) |
| `leek_put_save(code, callsign, profile)` | Stores the cloud save; **409** if the stored save has more completed runs |
| `leek_get_save(code)` / `leek_save_info(code)` | The save, or just its run count and time |

Writes are limited to one score and one save per 3 s per code (**429**), and to 20 new codes
per client IP per hour; only a hash of the IP is stored.

## Live daily board (Realtime)

During an online daily run each player joins the public Realtime channel
`leek-daily-<date>` with presence `{ callsign, score }`, updated at most every 1.5 s. The
presence key is a random per-session id, never the operative code. Presence is ephemeral and not
validated (any client can join the channel), so it only drives the live panel; the persisted
board always comes from `leek_submit_daily_run`. Free tier limits (200 concurrent Realtime
connections, 2M messages/month) cover a small player base comfortably.

## Identity

There are no accounts. Each device generates an **operative code** (`XXXX-XXXX-XXXX-XXXX`, 16
symbols without I/O/0/1, about 80 bits). The server stores only its SHA-256 hash. The code is
the key to the cloud save: typing it on another device restores the save there (**NUBE** in
Settings). Callsigns are public and limited to 3–16 characters (A–Z, 0–9, `-`).

The game runs in the browser, so no leaderboard can be fully cheat-proof; server-side scoring,
plausibility checks and rate limits make abuse slow and easy to clean up
(`delete from daily_scores where …` in the SQL editor).
