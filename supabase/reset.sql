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

-- Remove seed auth users created by a previous run (by their fixed seed UUIDs,
-- so gmail.com patient accounts are also cleared).
-- (do this after dropping public schema so the handle_new_user trigger is gone)
delete from auth.users where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777'
);

-- Also clean up any leftover test-domain seed users from older versions
delete from auth.users where email like '%@clinic.vn' or email like '%@clinic.test';

-- Stop the no-show cron jobs before dropping their functions
select cron.unschedule('clinic-manager-mark-no-show')
where exists (select 1 from cron.job where jobname = 'clinic-manager-mark-no-show');
select cron.unschedule('mark-no-show-stale-appointments')
where exists (select 1 from cron.job where jobname = 'mark-no-show-stale-appointments');