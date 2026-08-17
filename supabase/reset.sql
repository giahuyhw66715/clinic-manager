-- ============================================================================
-- ClinicManager - Reset to clean state
-- Run THIS query first in the SQL Editor, then run apply_all.sql in a new query.
-- Only run if the DB was partially applied before (existing tables / seed users).
-- ============================================================================

drop schema public cascade;

create schema public;

-- Re-apply the Supabase baseline grants so anon/authenticated can use the schema
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

-- Remove any seed auth users created by a previous partial run
-- (do this after dropping public schema so the handle_new_user trigger is gone)
delete from auth.users where email like '%@clinic.vn' or email like '%@clinic.test';