-- LEEK OPS online, revision 5: the live daily board, validated by the server.
--
-- The live board (who is in today's daily right now) used Supabase Realtime presence: a public
-- channel where any holder of the publishable key could claim any score, so every viewer had to
-- filter fakes itself (a raw client once showed 5000 points at 00:07 on everyone's board). Realtime
-- is gone with the project. Now each client reports its live score and run time under a random
-- per-session key (leek_live_update, every 1.5 s) and polls the board (leek_live_board, every
-- 2.5 s), and the server keeps the checks the clients used to run:
--
-- 1. A presence clock. The first report of a key records when it was seen and its run time,
--    which must be near the start (the client reports from the first second of the run). Later
--    reports may not claim more run time than real time has passed since then. Without this a
--    fake could claim an hour of play to lift its score ceiling.
-- 2. The score ceiling of src/game/online/LiveRanking.ts (liveScoreCeiling) for the claimed run
--    time: generous for any real run, far below what a fake wants to show.
-- 3. Rows expire from the board 20 s after their last report, so leaving needs no call, and are
--    deleted two days later. Only a hash of each key is stored; the board shows a prefix of it.
--
-- Apply after 0003 (it uses leek_level_ceiling). Clients built before this revision never call
-- these functions; clients built after it work without them (the live board just stays empty).

create table if not exists public.live_presence (
  day date not null,
  key_hash text not null,
  callsign text not null check (callsign ~ '^[A-Z0-9-]{3,16}$'),
  score integer not null check (score >= 0),
  seconds integer not null check (seconds between 0 and 3600),
  first_seen_at timestamptz not null default now(),
  first_seconds integer not null,
  updated_at timestamptz not null default now(),
  primary key (day, key_hash)
);
create index if not exists live_presence_recent on public.live_presence (day, updated_at);
alter table public.live_presence enable row level security;
revoke all on public.live_presence from anon, authenticated;

-- Live keys are 16 random bytes in hex, made per run on the client. They are not secret in the
-- way operative codes are, but hashing them keeps the board's ids from being usable as a key.
create or replace function public.leek_live_key_hash(p_key text)
returns text language plpgsql immutable as $$
begin
  if p_key is null or p_key !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid live key' using errcode = '22023';
  end if;
  return encode(extensions.digest(p_key, 'sha256'), 'hex');
end $$;

-- Mirrors liveScoreCeiling in src/game/online/LiveRanking.ts: at most 40 + 3 kills per second,
-- the level those kills could reach with every XP multiplier, scored like operationScore()
-- without a victory.
create or replace function public.leek_live_score_ceiling(p_seconds integer)
returns integer language sql immutable as $$
  select (40 + 3 * greatest(p_seconds, 0)) * 10
    + public.leek_level_ceiling(40 + 3 * greatest(p_seconds, 0)) * 150
    + greatest(p_seconds, 0) * 4;
$$;

create or replace function public.leek_live_update(
  p_day date, p_key text, p_callsign text, p_score integer, p_seconds integer
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_hash text := public.leek_live_key_hash(p_key);
  v_callsign text := upper(p_callsign);
  v_row live_presence%rowtype;
begin
  if v_callsign is null or v_callsign !~ '^[A-Z0-9-]{3,16}$' then
    raise exception 'invalid callsign' using errcode = '22023';
  end if;
  if p_day is null or p_day not between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date + 1 then
    raise exception 'day out of range' using errcode = '22023';
  end if;
  if p_seconds is null or p_seconds not between 0 and 3600 or p_score is null or p_score < 0
     or p_score > public.leek_live_score_ceiling(p_seconds) then
    raise exception 'implausible live score' using errcode = '22023';
  end if;
  select * into v_row from live_presence where day = p_day and key_hash = v_hash for update;
  if not found then
    -- The client reports from the start of the run; a new key claiming a long run is a fake
    -- lifting its ceiling. The margin covers a first report lost to a flaky network.
    if p_seconds > 30 then
      raise exception 'live run started too long ago' using errcode = '22023';
    end if;
    -- New keys arrive once per run: a cheap moment to keep the table small.
    delete from live_presence where day < (now() at time zone 'utc')::date - 2;
    insert into live_presence (day, key_hash, callsign, score, seconds, first_seconds)
    values (p_day, v_hash, v_callsign, p_score, p_seconds, p_seconds)
    on conflict (day, key_hash) do nothing;
    return;
  end if;
  -- Clients report every 1.5 s; anything faster is dropped without an error, so a burst from a
  -- reconnecting tab costs nothing and breaks nothing.
  if v_row.updated_at > now() - interval '1 second' then
    return;
  end if;
  -- Run time excludes pauses, so it only falls behind real time. The slack covers request latency.
  if p_seconds > v_row.first_seconds + extract(epoch from now() - v_row.first_seen_at) + 10 then
    raise exception 'live run time ahead of real time' using errcode = '22023';
  end if;
  update live_presence set callsign = v_callsign, score = p_score, seconds = p_seconds, updated_at = now()
  where day = p_day and key_hash = v_hash;
end $$;

-- The best 10 players reporting in the last 20 s, plus the caller even if it is further down.
-- Ids are a prefix of the key hash: stable for the client's overtake checks, useless as a key.
create or replace function public.leek_live_board(p_day date, p_key text)
returns table (id text, callsign text, score integer, self boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_hash text := public.leek_live_key_hash(p_key);
begin
  -- Columns are qualified throughout: the output names (callsign, score) are also variables here.
  return query
    with live as (
      select l.key_hash, l.callsign, l.score, l.updated_at from live_presence l
      where l.day = p_day and l.updated_at > now() - interval '20 seconds'
    ), board as (
      (select t.* from live t order by t.score desc, t.updated_at asc, t.key_hash limit 10)
      union
      (select m.* from live m where m.key_hash = v_hash)
    )
    select left(b.key_hash, 12), b.callsign, b.score, b.key_hash = v_hash
    from board b
    order by b.score desc, b.updated_at asc, b.key_hash;
end $$;

revoke all on function public.leek_live_key_hash(text) from public, anon, authenticated;
revoke all on function public.leek_live_score_ceiling(integer) from public, anon, authenticated;
grant execute on function public.leek_live_update(date, text, text, integer, integer) to anon, authenticated;
grant execute on function public.leek_live_board(date, text) to anon, authenticated;

notify pgrst, 'reload schema';
