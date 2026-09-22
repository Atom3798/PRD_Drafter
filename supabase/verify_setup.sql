-- verify_setup.sql  (not a migration - a check you run after both migrations)
--
-- Enabling RLS is easy to skip, and skipping it is silently unsafe: the anon
-- key is public, so a table without RLS is a table the whole internet can read.
-- Run this in the Supabase SQL editor and read the three result sets.

-- 1. RLS must be ENABLED on all three tables. Every row must say `true`.
select
  c.relname  as table_name,
  c.relrowsecurity as rls_enabled,
  case when c.relrowsecurity then 'OK' else '*** DANGER: RLS IS OFF ***' end as verdict
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'prds', 'prd_versions')
order by c.relname;

-- 2. Expect 8 policies: 2 profiles, 4 prds, 2 prd_versions.
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3. The signup trigger must exist, or new users get no profile row.
select tgname as trigger_name, tgrelid::regclass as on_table
from pg_trigger
where tgname in ('on_auth_user_created', 'prds_touch_updated_at')
order by tgname;
