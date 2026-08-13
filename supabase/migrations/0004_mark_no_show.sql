-- ============================================================================
-- ClinicManager - Auto-mark no-show
-- Schedules a pg_cron job that runs daily at 00:00 Vietnam time (17:00 UTC) and
-- marks appointments from previous days that were never completed/cancelled as
-- no-show. This keeps the doctor queue and patient appointment list free of
-- stale "confirmed" rows.
-- ============================================================================

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.mark_no_show_stale_appointments()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Compare against Vietnam's calendar date, since the DB session runs in UTC.
  update public.appointments
    set status = 'no-show'
    where appointment_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date
      and status in ('pending', 'confirmed');
end;
$$;

-- Enable the cron schedule (runs daily at 00:00 Vietnam time / 17:00 UTC).
-- On the Supabase free tier, projects pause after 7 days of inactivity, which
-- also pauses cron jobs. Regular usage keeps the project active.
select cron.schedule(
  'mark-no-show-stale-appointments',
  '0 17 * * *',
  $$ select public.mark_no_show_stale_appointments(); $$
);
