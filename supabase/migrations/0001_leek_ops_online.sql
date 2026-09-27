-- LEEK OPS online services: daily leaderboard and cloud saves.
--
-- Identity is an "operative code" generated on the player's device. The server stores only its
-- SHA-256 hash, so a leaked table cannot be used to impersonate anyone. Every table has RLS
-- enabled with no policies: the public anon key can reach the data only through the
-- SECURITY DEFINER functions below, which validate input and rate-limit writes.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.operatives (
  code_hash text primary key,
  callsign text not null check (callsign ~ '^[A-Z0-9-]{3,16}$'),
  created_at timestamptz not null default now(),
  last_score_at timestamptz not null default to_timestamp(0),
  last_save_at timestamptz not null default to_timestamp(0)
);

create table if not exists public.daily_scores (
  code_hash text not null references public.operatives (code_hash) on delete cascade,
  day date not null,
  score integer not null check (score between 0 and 200000),
  updated_at timestamptz not null default now(),
  primary key (code_hash, day)
);
create index if not exists daily_scores_board on public.daily_scores (day, score desc);

create table if not exists public.cloud_saves (
  code_hash text primary key references public.operatives (code_hash) on delete cascade,
  profile jsonb not null check (pg_column_size(profile) < 65536),
  updated_at timestamptz not null default now()
);

alter table public.operatives enable row level security;
alter table public.daily_scores enable row level security;
alter table public.cloud_saves enable row level security;
revoke all on public.operatives, public.daily_scores, public.cloud_saves from anon, authenticated;

-- Codes are 16 characters from an unambiguous alphabet, grouped as XXXX-XXXX-XXXX-XXXX.
create or replace function public.leek_code_hash(p_code text)
returns text language plpgsql immutable as $$
begin
  if p_code is null or upper(p_code) !~ '^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$' then
    raise exception 'invalid operative code' using errcode = '22023';
  end if;
  return encode(extensions.digest(upper(p_code), 'sha256'), 'hex');
end $$;

-- Registers the code on first use, renames on later calls, and allows one write of each kind
-- ('score' or 'save') per 3 s, so a run end can submit a score and a save back to back.
create or replace function public.leek_touch(p_code text, p_callsign text, p_kind text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_hash text := public.leek_code_hash(p_code);
  v_last timestamptz;
begin
  if p_kind not in ('score', 'save') then
    raise exception 'unknown write kind' using errcode = '22023';
  end if;
  insert into operatives (code_hash, callsign) values (v_hash, upper(p_callsign))
  on conflict (code_hash) do nothing;
  select case p_kind when 'score' then last_score_at else last_save_at end
    into v_last from operatives where code_hash = v_hash for update;
  if v_last > now() - interval '3 seconds' then
    raise exception 'slow down' using errcode = '54000';
  end if;
  update operatives set
    callsign = upper(p_callsign),
    last_score_at = case when p_kind = 'score' then now() else last_score_at end,
    last_save_at = case when p_kind = 'save' then now() else last_save_at end
  where code_hash = v_hash;
  return v_hash;
end $$;

-- Keeps the best score per operative per day. The day must be within one day of server time,
-- which allows every time zone but not back-filling old boards.
create or replace function public.leek_submit_daily(p_code text, p_callsign text, p_day date, p_score integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_hash text;
  v_best integer;
begin
  if p_day not between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date + 1 then
    raise exception 'day out of range' using errcode = '22023';
  end if;
  v_hash := public.leek_touch(p_code, p_callsign, 'score');
  insert into daily_scores (code_hash, day, score) values (v_hash, p_day, p_score)
  on conflict (code_hash, day) do update
    set score = greatest(daily_scores.score, excluded.score), updated_at = now()
  returning score into v_best;
  return v_best;
end $$;

create or replace function public.leek_daily_board(p_day date, p_limit integer default 10)
returns table (rank bigint, callsign text, score integer)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by s.score desc, s.updated_at asc), o.callsign, s.score
  from daily_scores s join operatives o using (code_hash)
  where s.day = p_day
  order by s.score desc, s.updated_at asc
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.leek_put_save(p_code text, p_callsign text, p_profile jsonb)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_hash text := public.leek_touch(p_code, p_callsign, 'save');
  v_at timestamptz := now();
begin
  if jsonb_typeof(p_profile) <> 'object' then
    raise exception 'profile must be an object' using errcode = '22023';
  end if;
  insert into cloud_saves (code_hash, profile, updated_at) values (v_hash, p_profile, v_at)
  on conflict (code_hash) do update set profile = excluded.profile, updated_at = v_at;
  return v_at;
end $$;

create or replace function public.leek_get_save(p_code text)
returns table (profile jsonb, callsign text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.profile, o.callsign, c.updated_at
  from cloud_saves c join operatives o using (code_hash)
  where c.code_hash = public.leek_code_hash(p_code);
$$;

revoke all on function public.leek_touch(text, text, text) from public, anon, authenticated;
grant execute on function public.leek_code_hash(text) to anon, authenticated;
grant execute on function public.leek_submit_daily(text, text, date, integer) to anon, authenticated;
grant execute on function public.leek_daily_board(date, integer) to anon, authenticated;
grant execute on function public.leek_put_save(text, text, jsonb) to anon, authenticated;
grant execute on function public.leek_get_save(text) to anon, authenticated;
