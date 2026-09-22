-- 002_rls_policies.sql
-- Row Level Security. This is the real ownership boundary.
--
-- The backend talks to Postgres using the CALLER'S JWT and the anon key, never
-- the service role key. So these policies - not application code - are what
-- stop user A reading user B's PRD. A missing `where user_id = ...` in Python
-- is a bug, not a breach.
--
-- Run this AFTER 001_initial_schema.sql, then run supabase/verify_setup.sql.

alter table public.profiles     enable row level security;
alter table public.prds         enable row level security;
alter table public.prd_versions enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: a user sees and edits only their own row.
-- No insert policy: rows are created by the handle_new_user() trigger, which
-- is security definer. No delete policy: profiles cascade from auth.users.
-- ---------------------------------------------------------------------------
drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile update" on public.profiles;

create policy "own profile read"   on public.profiles
  for select using (auth.uid() = id);

create policy "own profile update" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- prds: full CRUD, scoped to the owner.
-- The `with check` on update prevents reassigning a PRD to another user.
-- ---------------------------------------------------------------------------
drop policy if exists "own prds read"   on public.prds;
drop policy if exists "own prds insert" on public.prds;
drop policy if exists "own prds update" on public.prds;
drop policy if exists "own prds delete" on public.prds;

create policy "own prds read"   on public.prds
  for select using (auth.uid() = user_id);

create policy "own prds insert" on public.prds
  for insert with check (auth.uid() = user_id);

create policy "own prds update" on public.prds
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own prds delete" on public.prds
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- prd_versions: reachable only through a PRD you own.
-- Append-only by design: there is no update or delete policy, so version
-- history cannot be rewritten or destroyed, including by its owner.
-- ---------------------------------------------------------------------------
drop policy if exists "own versions read"   on public.prd_versions;
drop policy if exists "own versions insert" on public.prd_versions;

create policy "own versions read" on public.prd_versions
  for select using (
    exists (
      select 1 from public.prds p
      where p.id = prd_id and p.user_id = auth.uid()
    )
  );

create policy "own versions insert" on public.prd_versions
  for insert with check (
    exists (
      select 1 from public.prds p
      where p.id = prd_id and p.user_id = auth.uid()
    )
  );
