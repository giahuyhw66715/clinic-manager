-- ============================================================================
-- Auto-mark an invoice as paid when the pharmacist delivers the prescription
-- (status -> 'delivered'). Enforced at the database level so it applies no
-- matter which UI path triggers the delivery.
--
--   - prescriptions: when a prescription becomes 'delivered', mark the matching
--     unpaid invoice for the same appointment as paid.
--   - invoices:      if an invoice is created for an appointment whose
--     prescription is already 'delivered', create it as paid (covers the edge
--     case where delivery happens before the doctor finishes the visit).
-- ============================================================================

create or replace function public.mark_invoice_paid_on_deliver()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'delivered'
     and (tg_op = 'INSERT' or old.status is distinct from 'delivered') then
    update public.invoices
       set paid = true,
           paid_at = now()
     where appointment_id = new.appointment_id
       and paid = false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_paid_on_deliver on public.prescriptions;
create trigger trg_invoice_paid_on_deliver
  before insert or update of status on public.prescriptions
  for each row execute function public.mark_invoice_paid_on_deliver();

create or replace function public.mark_invoice_paid_if_delivered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.appointment_id is not null
     and not new.paid
     and exists (
       select 1 from public.prescriptions p
       where p.appointment_id = new.appointment_id
         and p.status = 'delivered'
     ) then
    new.paid := true;
    new.paid_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_paid_if_delivered on public.invoices;
create trigger trg_invoice_paid_if_delivered
  before insert on public.invoices
  for each row execute function public.mark_invoice_paid_if_delivered();