-- ============================================================================
-- ClinicManager - Daily appointment reminders (in-app notifications)
-- Schedules a pg_cron job that runs daily at 00:00 Vietnam time (17:00 UTC) and
-- notifies patients who have a pending appointment tomorrow.
-- ============================================================================

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.send_tomorrow_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Compare against Vietnam's calendar date, since the DB session runs in UTC.
  insert into public.notifications (user_id, type, title, body)
  select
    a.patient_id,
    'reminder',
    'Appointment reminder',
    'You have an appointment tomorrow at ' || to_char(a.time_slot, 'HH24:MI') ||
      ' with Dr. ' || coalesce(p.full_name, 'the doctor') || '.'
  from public.appointments a
  join public.doctors d on d.id = a.doctor_id
  left join public.profiles p on p.id = d.user_id
  where a.appointment_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date + 1
    and a.status in ('pending');
end;
$$;

-- Enable the cron schedule (runs daily at 00:00 Vietnam time / 17:00 UTC).
-- On the Supabase free tier, projects pause after 7 days of inactivity, which
-- also pauses cron jobs. Regular usage keeps the project active.
select cron.schedule(
  'send-tomorrow-reminders',
  '0 17 * * *',
  $$ select public.send_tomorrow_reminders(); $$
);