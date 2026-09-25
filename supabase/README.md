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

## One-time database setup

**Status:** `0001_leek_ops_online.sql` was applied to project `tawimigwbpwtwwkeaglg` on
2026-09-25 and smoke-tested as the `anon` role (submit, rate limit, save, restore, board, input
validation, and denied direct table access). To apply it to another project, either:

- **Dashboard**: SQL Editor → New query → paste the file → Run; or
- **Supabase MCP** (configured in `.mcp.json`): after authenticating with `claude /mcp` in a
  terminal, ask Claude Code to apply the migration.

It creates three tables (`operatives`, `daily_scores`, `cloud_saves`) with row-level security
enabled and no policies, so the anon key cannot read or write them directly. All access goes
through these functions:

| Function | Purpose |
|---|---|
| `leek_submit_daily(code, callsign, day, score)` | Keeps the best score per operative per day; the day must be within ±1 day of server time |
| `leek_daily_board(day, limit)` | Top scores for a day (callsign and score only) |
| `leek_put_save(code, callsign, profile)` | Stores the cloud save (under 64 KB) |
| `leek_get_save(code)` | Returns the save for a code |

## Identity

There are no accounts. Each device generates an **operative code** (`XXXX-XXXX-XXXX-XXXX`, 16
symbols without I/O/0/1, about 80 bits). The server stores only its SHA-256 hash. The code is
the key to the cloud save: typing it on another device restores the save there (**NUBE** in
Settings). Callsigns are public and limited to 3–16 characters (A–Z, 0–9, `-`).

Writes are rate-limited to one score and one save every 3 seconds per code. Scores are reported
by the client, so the board trusts players the way any client-side game does; the bounds and
rate limits keep abuse cheap to clean up (`delete from daily_scores where …` in the SQL editor).
