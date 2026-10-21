-- LEEK OPS online, revision 4: the backend runs on our own VPS (Postgres + PostgREST).
--
-- 1. The client IP comes from X-Client-Ip, which the game's nginx sets from the connection itself
--    (or from Cloudflare's header when the request came through the tunnel) after dropping every
--    forwarding header the client sent. 0002 read cf-connecting-ip / x-forwarded-for directly, so
--    a made-up header dodged the per-network limit on new operatives.
-- 2. The IP is stored as an HMAC under a random salt that never leaves the database. 0002 hashed it
--    with a public prefix, which anyone holding the table could reverse by hashing all of IPv4.
-- 3. IPv6 clients are grouped by /64: a provider hands each customer a whole /64, so limiting
--    single addresses would be no limit at all.

create table if not exists public.leek_secrets (name text primary key, value bytea not null);
alter table public.leek_secrets enable row level security;
revoke all on public.leek_secrets from anon, authenticated;
insert into public.leek_secrets (name, value) values ('ip_salt', extensions.gen_random_bytes(32))
on conflict (name) do nothing;

create or replace function public.leek_client_ip_hash()
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_ip text := nullif(trim(nullif(current_setting('request.headers', true), '')::json ->> 'x-client-ip'), '');
begin
  if v_ip is null then return null; end if;
  if position(':' in v_ip) > 0 then
    v_ip := array_to_string((string_to_array(v_ip, ':'))[1:4], ':');
  end if;
  return encode(extensions.hmac(convert_to(v_ip, 'UTF8'),
    (select value from leek_secrets where name = 'ip_salt'), 'sha256'), 'hex');
end $$;

revoke all on function public.leek_client_ip_hash() from public, anon, authenticated;

notify pgrst, 'reload schema';
