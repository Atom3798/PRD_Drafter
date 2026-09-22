-- 001_initial_schema.sql
-- Core tables for PRD Drafter.
--
-- Three tables, deliberately. A PRD owns its inputs, and a wizard draft is
-- just a PRD with status = 'draft'. There is no separate `projects` or
-- `prd_inputs` table.
--
-- Run this BEFORE 002_rls_policies.sql.

create extension if not exists "uuid-ossp";
-- Needed for the trigram index on prds.title (dashboard search).
-- If your Postgres does not have pg_trgm, drop the prds_title_trgm_idx
-- index below; search falls back to ILIKE without it.
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- prds
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'prd_status') then
    create type prd_status as enum ('draft', 'generating', 'generated', 'failed');
  end if;
end $$;

create table if not exists public.prds (
  id                    uuid primary key default uuid_generate_v4(),
  -- Defaults to the caller so application code cannot forget to set an
  -- owner. The RLS insert policy still checks it with `auth.uid() = user_id`,
  -- so an explicitly supplied value is validated rather than trusted.
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title                 text not null default 'Untitled PRD',
  status                prd_status not null default 'draft',
  inputs                jsonb not null default '{}'::jsonb,
  content               jsonb,
  assumptions           jsonb not null default '[]'::jsonb,
  wizard_step           int not null default 1,
  generation_error      text,
  provider              text,
  model                 text,
  token_usage           jsonb,
  generation_started_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists prds_user_id_updated_at_idx
  on public.prds (user_id, updated_at desc);

create index if not exists prds_title_trgm_idx
  on public.prds using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- prd_versions  (append-only; snapshot on generate and regenerate only)
-- ---------------------------------------------------------------------------
create table if not exists public.prd_versions (
  id              uuid primary key default uuid_generate_v4(),
  prd_id          uuid not null references public.prds(id) on delete cascade,
  version_number  int not null,
  content         jsonb not null,
  change_summary  text not null,
  created_at      timestamptz not null default now(),
  unique (prd_id, version_number)
);

create index if not exists prd_versions_prd_id_idx
  on public.prd_versions (prd_id, version_number desc);

-- ---------------------------------------------------------------------------
-- triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists prds_touch_updated_at on public.prds;
create trigger prds_touch_updated_at
  before update on public.prds
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create a profile row whenever someone signs up.
-- security definer because it writes to public.profiles from an auth trigger.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
