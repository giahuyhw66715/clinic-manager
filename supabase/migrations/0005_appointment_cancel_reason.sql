-- ============================================================================
-- ClinicManager - Appointment cancellation reason + auto-cancel stale visits
-- Adds cancel_reason to appointments, and extends the nightly job so visits that
-- were checked-in / in-progress but never completed are auto-cancelled too.
-- The cron schedule from 0004 still points at the (replaced) function, so no
-- reschedule is needed here.
-- ============================================================================

alter table public.appointments
  add column cancel_reason text;

create or replace function public.mark_no_show_stale_appointments()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Compare against Vietnam's calendar date, since the DB session runs in UTC.
  -- Never arrived -> no-show
  update public.appointments
    set status = 'no-show'
    where appointment_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date
      and status in ('pending', 'confirmed');

  -- Came but the visit was never completed -> cancelled
  update public.appointments
    set status = 'cancelled',
        cancel_reason = 'Buổi khám không được hoàn tất trong ngày'
    where appointment_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date
      and status in ('checked-in', 'in-progress');
end;
$$;
