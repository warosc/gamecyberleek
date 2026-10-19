-- LEEK OPS online, revision 3.
--
-- 1. Daily runs need a server ticket. leek_start_daily_run issues one when a run starts; the
--    result is accepted once per ticket, only for the code and day it was issued to, and only if
--    the claimed run time fits in the real time since the ticket was issued. Before this, a single
--    request could post an hour-long, 17 000-kill run that no one had played.
-- 2. Tighter plausibility, matching the live board's ceilings (src/game/online/LiveRanking.ts):
--    at most 40 + 3 kills per second of run time, and no level above what that many kills could
--    reach with every XP multiplier. Real runs sit far below both.
-- 3. Cloud saves never store the operative code. The client used to upload the whole profile,
--    code included, so anyone reading cloud_saves could take over every save. Existing rows are
--    cleaned here.
--
-- Apply after 0002: SQL Editor -> New query -> paste -> Run. Game clients built after commit
-- 29820eb work before and after this migration; older clients stop posting daily scores once it
-- is applied (their submit signature is dropped below), which is the point.

create table if not exists public.daily_runs (
  ticket uuid primary key default gen_random_uuid(),
  code_hash text not null,
  day date not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);
create index if not exists daily_runs_by_code on public.daily_runs (code_hash, started_at);
create index if not exists daily_runs_by_age on public.daily_runs (started_at);
alter table public.daily_runs enable row level security;
revoke all on public.daily_runs from anon, authenticated;

create or replace function public.leek_start_daily_run(p_code text, p_day date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_hash text := public.leek_code_hash(p_code);
  v_ticket uuid;
begin
  if p_day not between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date + 1 then
    raise exception 'day out of range' using errcode = '22023';
  end if;
  -- A real player starts a run every few minutes at most.
  if (select count(*) from daily_runs where code_hash = v_hash and started_at > now() - interval '1 hour') >= 60 then
    raise exception 'slow down' using errcode = 'PT429';
  end if;
  -- Tickets are only useful for the day they were issued; keep the table small.
  delete from daily_runs where started_at < now() - interval '3 days';
  insert into daily_runs (code_hash, day) values (v_hash, p_day) returning ticket into v_ticket;
  return v_ticket;
end $$;

-- Mirrors levelForXp(liveScoreCeiling) in src/game/online/LiveRanking.ts: the richest regular kill
-- (96 XP), both bosses (680 XP) and a 3x multiplier, on the curve floor(40 * 1.28^(level - 1)).
create or replace function public.leek_level_ceiling(p_kills integer)
returns integer language plpgsql immutable as $$
declare
  v_left numeric := (greatest(p_kills, 0)::numeric * 96 + 680) * 3;
  v_level integer := 1;
begin
  while v_level < 80 and v_left >= floor(40 * power(1.28, v_level - 1)) loop
    v_left := v_left - floor(40 * power(1.28, v_level - 1));
    v_level := v_level + 1;
  end loop;
  return v_level;
end $$;

drop function if exists public.leek_submit_daily_run(text, text, date, integer, integer, integer, boolean);

create or replace function public.leek_submit_daily_run(
  p_ticket uuid, p_code text, p_callsign text, p_day date,
  p_kills integer, p_level integer, p_duration_ms integer, p_victory boolean
) returns integer language plpgsql security definer set search_path = public as $$
declare
  v_hash text := public.leek_code_hash(p_code);
  v_run daily_runs%rowtype;
  v_seconds integer;
  v_score integer;
  v_best integer;
begin
  select * into v_run from daily_runs where ticket = p_ticket for update;
  if not found or v_run.code_hash <> v_hash or v_run.day <> p_day then
    raise exception 'unknown run ticket' using errcode = '22023';
  end if;
  if v_run.submitted_at is not null then
    raise exception 'run already submitted' using errcode = '22023';
  end if;
  -- Run time excludes pauses, so it can only be shorter than real time. The slack covers the
  -- ticket request landing a little after the run started.
  if p_duration_ms > extract(epoch from now() - v_run.started_at) * 1000 + 30000 then
    raise exception 'run longer than its ticket' using errcode = '22023';
  end if;
  v_seconds := p_duration_ms / 1000;
  if p_duration_ms not between 0 and 3600000
     or p_kills not between 0 and 40 + 3 * v_seconds
     or p_level not between 1 and public.leek_level_ceiling(p_kills) then
    raise exception 'implausible run' using errcode = '22023';
  end if;
  -- The commander arrives at 4:00, so no victory is possible before that.
  if p_victory and p_duration_ms < 240000 then
    raise exception 'implausible victory' using errcode = '22023';
  end if;
  v_score := public.leek_run_score(p_kills, p_level, p_duration_ms, p_victory);
  perform public.leek_touch(p_code, p_callsign, 'score');
  update daily_runs set submitted_at = now() where ticket = p_ticket;
  insert into daily_scores (code_hash, day, score) values (v_hash, p_day, v_score)
  on conflict (code_hash, day) do update
    set score = greatest(daily_scores.score, excluded.score), updated_at = now()
  returning score into v_best;
  return v_best;
end $$;

create or replace function public.leek_put_save(p_code text, p_callsign text, p_profile jsonb)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_hash text := public.leek_code_hash(p_code);
  v_at timestamptz := now();
  v_stored integer;
  v_incoming integer;
begin
  if jsonb_typeof(p_profile) <> 'object' then
    raise exception 'profile must be an object' using errcode = '22023';
  end if;
  select coalesce((profile ->> 'runs')::integer, 0) into v_stored from cloud_saves where code_hash = v_hash;
  v_incoming := coalesce((p_profile ->> 'runs')::integer, 0);
  if v_stored is not null and v_incoming < v_stored then
    raise exception 'the cloud save is further ahead (% runs)', v_stored using errcode = 'PT409';
  end if;
  perform public.leek_touch(p_code, p_callsign, 'save');
  -- The code is the key to this row; it is never stored inside it, even if an old client sends it.
  insert into cloud_saves (code_hash, profile, updated_at) values (v_hash, p_profile - 'operative', v_at)
  on conflict (code_hash) do update set profile = excluded.profile, updated_at = v_at;
  return v_at;
end $$;

update public.cloud_saves set profile = profile - 'operative' where profile ? 'operative';

revoke all on function public.leek_level_ceiling(integer) from public, anon, authenticated;
grant execute on function public.leek_start_daily_run(text, date) to anon, authenticated;
grant execute on function public.leek_submit_daily_run(uuid, text, text, date, integer, integer, integer, boolean) to anon, authenticated;
grant execute on function public.leek_put_save(text, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
