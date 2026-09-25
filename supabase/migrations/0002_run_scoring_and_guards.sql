-- LEEK OPS online, revision 2.
--
-- 1. The server computes daily scores from the run's facts instead of trusting a client total,
--    and rejects impossible runs (a win before the commander arrives at 4:00, kill rates no build
--    reaches, out-of-range levels or durations).
-- 2. A cloud save with fewer completed runs than the stored one is refused (HTTP 409), so an
--    older device can never overwrite progress made on another.
-- 3. New operative codes are limited per client IP and hour, which makes flooding the board with
--    throwaway codes slow. Only a hash of the IP is stored.
-- 4. Rate limits answer HTTP 429 and conflicts 409 (PostgREST maps SQLSTATE PTxxx to status xxx).

alter table public.operatives add column if not exists created_ip_hash text;
create index if not exists operatives_created_ip on public.operatives (created_ip_hash, created_at);

create or replace function public.leek_client_ip_hash()
returns text language plpgsql stable as $$
declare
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text;
begin
  v_ip := coalesce(v_headers ->> 'cf-connecting-ip', split_part(v_headers ->> 'x-forwarded-for', ',', 1));
  if v_ip is null or v_ip = '' then return null; end if;
  return encode(extensions.digest('leek-ops:' || trim(v_ip), 'sha256'), 'hex');
end $$;

create or replace function public.leek_touch(p_code text, p_callsign text, p_kind text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_hash text := public.leek_code_hash(p_code);
  v_ip text := public.leek_client_ip_hash();
  v_last timestamptz;
begin
  if p_kind not in ('score', 'save') then
    raise exception 'unknown write kind' using errcode = '22023';
  end if;
  if not exists (select 1 from operatives where code_hash = v_hash) then
    if v_ip is not null and (select count(*) from operatives
        where created_ip_hash = v_ip and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'too many new operatives from this network' using errcode = 'PT429';
    end if;
    insert into operatives (code_hash, callsign, created_ip_hash) values (v_hash, upper(p_callsign), v_ip)
    on conflict (code_hash) do nothing;
  end if;
  select case p_kind when 'score' then last_score_at else last_save_at end
    into v_last from operatives where code_hash = v_hash for update;
  if v_last > now() - interval '3 seconds' then
    raise exception 'slow down' using errcode = 'PT429';
  end if;
  update operatives set
    callsign = upper(p_callsign),
    last_score_at = case when p_kind = 'score' then now() else last_score_at end,
    last_save_at = case when p_kind = 'save' then now() else last_save_at end
  where code_hash = v_hash;
  return v_hash;
end $$;

-- Mirrors operationScore() in src/game/progression/DailyOperation.ts.
create or replace function public.leek_run_score(p_kills integer, p_level integer, p_duration_ms integer, p_victory boolean)
returns integer language sql immutable as $$
  select (p_kills * 10 + p_level * 150 + (p_duration_ms / 1000) * 4
    + case when p_victory then 3000 + greatest(0, 480 - p_duration_ms / 1000) * 10 else 0 end)::integer;
$$;

create or replace function public.leek_submit_daily_run(
  p_code text, p_callsign text, p_day date,
  p_kills integer, p_level integer, p_duration_ms integer, p_victory boolean
) returns integer language plpgsql security definer set search_path = public as $$
declare
  v_hash text;
  v_score integer;
  v_best integer;
begin
  if p_day not between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date + 1 then
    raise exception 'day out of range' using errcode = '22023';
  end if;
  if p_duration_ms not between 0 and 3600000 or p_level not between 1 and 80
     or p_kills not between 0 and (p_duration_ms / 1000 + 1) * 8 then
    raise exception 'implausible run' using errcode = '22023';
  end if;
  -- The commander arrives at 4:00, so no victory is possible before that.
  if p_victory and p_duration_ms < 240000 then
    raise exception 'implausible victory' using errcode = '22023';
  end if;
  v_score := public.leek_run_score(p_kills, p_level, p_duration_ms, p_victory);
  v_hash := public.leek_touch(p_code, p_callsign, 'score');
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
  insert into cloud_saves (code_hash, profile, updated_at) values (v_hash, p_profile, v_at)
  on conflict (code_hash) do update set profile = excluded.profile, updated_at = v_at;
  return v_at;
end $$;

-- Light metadata so a device can check for a newer cloud save without downloading it.
create or replace function public.leek_save_info(p_code text)
returns table (runs integer, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce((c.profile ->> 'runs')::integer, 0), c.updated_at
  from cloud_saves c where c.code_hash = public.leek_code_hash(p_code);
$$;

-- The client-reported score path is retired.
drop function if exists public.leek_submit_daily(text, text, date, integer);

revoke all on function public.leek_touch(text, text, text) from public, anon, authenticated;
revoke all on function public.leek_client_ip_hash() from public, anon, authenticated;
grant execute on function public.leek_run_score(integer, integer, integer, boolean) to anon, authenticated;
grant execute on function public.leek_submit_daily_run(text, text, date, integer, integer, integer, boolean) to anon, authenticated;
grant execute on function public.leek_put_save(text, text, jsonb) to anon, authenticated;
grant execute on function public.leek_save_info(text) to anon, authenticated;

notify pgrst, 'reload schema';
