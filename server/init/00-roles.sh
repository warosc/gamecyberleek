#!/bin/sh
# Runs once, when the database volume is first created. Recreates what a Supabase project provides
# and the migrations assume: the anon/authenticated roles PostgREST switches to, the login role it
# connects as, the `extensions` schema, and the table that records applied migrations.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
create role anon nologin;
create role authenticated nologin;
create role authenticator login noinherit password '${AUTHENTICATOR_PASSWORD}';
grant anon, authenticated to authenticator;
create schema extensions;
create table public.schema_migrations (name text primary key, applied_at timestamptz not null default now());
revoke all on public.schema_migrations from public;
SQL
