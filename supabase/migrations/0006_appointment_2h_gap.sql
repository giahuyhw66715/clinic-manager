-- ============================================================================
-- Prevent a patient from having two appointments less than 1 hour apart,
-- even with different doctors. Enforced at the database level.
--
--   - Fires on INSERT (patient / admin booking)
--   - Fires on UPDATE of patient_id / appointment_date / time_slot (reschedule)
--   - Does NOT fire on status-only changes (cancel, complete, no-show, ...)
-- ============================================================================

create or replace function public.prevent_patient_2h_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_start timestamp;
  existing_start timestamp;
begin
  new_start := new.appointment_date + new.time_slot;

  select a.appointment_date + a.time_slot
    into existing_start
    from public.appointments a
   where a.patient_id = new.patient_id
     and a.status not in ('cancelled', 'no-show')
     and a.id <> new.id
     and abs(extract(epoch from (a.appointment_date + a.time_slot) - new_start)) < 3600
   limit 1;

  if found then
    raise exception 'Bệnh nhân đã có lịch hẹn lúc % - cách khung giờ này chưa đủ 1 tiếng.',
      to_char(existing_start, 'HH24:MI');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_appointments_patient_2h_insert on public.appointments;
create trigger trg_appointments_patient_2h_insert
  before insert on public.appointments
  for each row execute function public.prevent_patient_2h_overlap();

drop trigger if exists trg_appointments_patient_2h_update on public.appointments;
create trigger trg_appointments_patient_2h_update
  before update of patient_id, appointment_date, time_slot on public.appointments
  for each row execute function public.prevent_patient_2h_overlap();