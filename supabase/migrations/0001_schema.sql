-- ============================================================================
-- ClinicManager - Schema, RLS policies, triggers, realtime
-- Run this first, then 0002_seed.sql and 0003_notifications.sql
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('patient', 'doctor', 'pharmacist', 'admin');
create type public.appointment_status as enum (
  'pending', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show'
);
create type public.prescription_status as enum ('sent', 'preparing', 'ready', 'delivered');
create type public.severity as enum ('mild', 'moderate', 'severe');

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  phone text,
  role public.user_role not null default 'patient',
  allergies text,
  created_at timestamptz not null default now()
);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  department_id uuid references public.departments (id) on delete set null,
  specialty text,
  bio text,
  consultation_fee numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes int not null default 30,
  unique (doctor_id, day_of_week)
);

create table public.doctor_off_days (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  off_date date not null,
  reason text,
  unique (doctor_id, off_date)
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  dosage_unit text,
  price numeric(10, 2) not null default 0,
  stock_qty int not null default 0 check (stock_qty >= 0),
  reorder_level int not null default 10,
  created_at timestamptz not null default now()
);

create table public.drug_interactions (
  id uuid primary key default gen_random_uuid(),
  medication_a_id uuid not null references public.medications (id) on delete cascade,
  medication_b_id uuid not null references public.medications (id) on delete cascade,
  severity public.severity not null default 'moderate',
  description text,
  check (medication_a_id <> medication_b_id),
  unique (medication_a_id, medication_b_id)
);

create table public.patient_allergies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  medication_id uuid references public.medications (id) on delete set null,
  allergen text,
  severity public.severity not null default 'mild',
  check (medication_id is not null or allergen is not null)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  appointment_date date not null,
  time_slot time not null,
  reason text,
  status public.appointment_status not null default 'pending',
  paid boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (doctor_id, appointment_date, time_slot)
);

create index appointments_patient_idx on public.appointments (patient_id);
create index appointments_doctor_date_idx on public.appointments (doctor_id, appointment_date);

create table public.medical_records (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id) on delete set null,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  symptoms text,
  diagnosis text,
  notes text,
  treatment_plan text,
  created_at timestamptz not null default now()
);

create index medical_records_patient_idx on public.medical_records (patient_id);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id) on delete set null,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  status public.prescription_status not null default 'sent',
  notes text,
  created_at timestamptz not null default now()
);

create index prescriptions_patient_idx on public.prescriptions (patient_id);
create index prescriptions_status_idx on public.prescriptions (status);

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  medication_id uuid not null references public.medications (id) on delete cascade,
  dosage text,
  quantity int not null default 1 check (quantity > 0),
  instructions text
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id) on delete set null,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  total_amount numeric(10, 2) not null default 0,
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- New user trigger -> create profile row
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Helper functions for RLS
-- ----------------------------------------------------------------------------
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_doctor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.doctors where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'admin';
$$;

-- ----------------------------------------------------------------------------
-- Enable RLS
-- ----------------------------------------------------------------------------
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.doctors enable row level security;
alter table public.doctor_schedules enable row level security;
alter table public.doctor_off_days enable row level security;
alter table public.medications enable row level security;
alter table public.drug_interactions enable row level security;
alter table public.patient_allergies enable row level security;
alter table public.appointments enable row level security;
alter table public.medical_records enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.invoices enable row level security;
alter table public.notifications enable row level security;

-- ----------------------------------------------------------------------------
-- departments
-- ----------------------------------------------------------------------------
create policy "departments_select" on public.departments
  for select using (auth.role() = 'authenticated');
create policy "departments_admin_all" on public.departments
  for all using (public.is_admin());

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin());

-- ----------------------------------------------------------------------------
-- doctors
-- ----------------------------------------------------------------------------
create policy "doctors_select" on public.doctors
  for select using (auth.role() = 'authenticated');
create policy "doctors_admin_all" on public.doctors
  for all using (public.is_admin());

-- ----------------------------------------------------------------------------
-- doctor_schedules
-- ----------------------------------------------------------------------------
create policy "doctor_schedules_select" on public.doctor_schedules
  for select using (auth.role() = 'authenticated');
create policy "doctor_schedules_admin_own" on public.doctor_schedules
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.doctors d
      where d.id = doctor_id and d.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- doctor_off_days
-- ----------------------------------------------------------------------------
create policy "doctor_off_days_select" on public.doctor_off_days
  for select using (auth.role() = 'authenticated');
create policy "doctor_off_days_admin_own" on public.doctor_off_days
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.doctors d
      where d.id = doctor_id and d.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- medications
-- ----------------------------------------------------------------------------
create policy "medications_select" on public.medications
  for select using (auth.role() = 'authenticated');
create policy "medications_manage" on public.medications
  for all using (public.is_admin() or public.current_role() = 'pharmacist');

-- ----------------------------------------------------------------------------
-- drug_interactions
-- ----------------------------------------------------------------------------
create policy "drug_interactions_select" on public.drug_interactions
  for select using (auth.role() = 'authenticated');
create policy "drug_interactions_admin" on public.drug_interactions
  for all using (public.is_admin());

-- ----------------------------------------------------------------------------
-- patient_allergies
-- ----------------------------------------------------------------------------
create policy "patient_allergies_select" on public.patient_allergies
  for select using (
    patient_id = auth.uid()
    or public.is_admin()
    or public.current_role() in ('doctor', 'pharmacist')
  );
create policy "patient_allergies_manage" on public.patient_allergies
  for all using (patient_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- appointments
-- ----------------------------------------------------------------------------
create policy "appointments_select" on public.appointments
  for select using (
    patient_id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'pharmacist'
    or doctor_id = public.current_doctor_id()
  );
create policy "appointments_insert" on public.appointments
  for insert with check (
    public.is_admin()
    or (public.current_role() = 'patient' and patient_id = auth.uid())
  );
create policy "appointments_update" on public.appointments
  for update using (
    public.is_admin()
    or public.current_role() = 'pharmacist'
    or doctor_id = public.current_doctor_id()
  );
create policy "appointments_delete_admin" on public.appointments
  for delete using (public.is_admin());

-- ----------------------------------------------------------------------------
-- medical_records
-- ----------------------------------------------------------------------------
create policy "medical_records_select" on public.medical_records
  for select using (
    patient_id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'doctor'
    and (
      doctor_id = public.current_doctor_id()
      or patient_id in (
        select a.patient_id from public.appointments a
        where a.doctor_id = public.current_doctor_id()
      )
    )
  );
create policy "medical_records_insert" on public.medical_records
  for insert with check (
    public.is_admin()
    or (public.current_role() = 'doctor' and doctor_id = public.current_doctor_id())
  );
create policy "medical_records_update" on public.medical_records
  for update using (
    public.is_admin()
    or (public.current_role() = 'doctor' and doctor_id = public.current_doctor_id())
  );
create policy "medical_records_delete_admin" on public.medical_records
  for delete using (public.is_admin());

-- ----------------------------------------------------------------------------
-- prescriptions
-- ----------------------------------------------------------------------------
create policy "prescriptions_select" on public.prescriptions
  for select using (
    patient_id = auth.uid()
    or public.is_admin()
    or public.current_role() = 'pharmacist'
    or public.current_role() = 'doctor'
    and (
      doctor_id = public.current_doctor_id()
      or patient_id in (
        select a.patient_id from public.appointments a
        where a.doctor_id = public.current_doctor_id()
      )
    )
  );
create policy "prescriptions_insert" on public.prescriptions
  for insert with check (
    public.is_admin()
    or (public.current_role() = 'doctor' and doctor_id = public.current_doctor_id())
  );
create policy "prescriptions_update" on public.prescriptions
  for update using (
    public.is_admin()
    or public.current_role() = 'pharmacist'
    or (public.current_role() = 'doctor' and doctor_id = public.current_doctor_id())
  );
create policy "prescriptions_delete_admin" on public.prescriptions
  for delete using (public.is_admin());

-- ----------------------------------------------------------------------------
-- prescription_items
-- ----------------------------------------------------------------------------
create policy "prescription_items_select" on public.prescription_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.prescriptions p
      where p.id = prescription_id
        and (
          p.patient_id = auth.uid()
          or public.current_role() = 'pharmacist'
          or public.current_role() = 'doctor'
          and (
            p.doctor_id = public.current_doctor_id()
            or p.patient_id in (
              select a.patient_id from public.appointments a
              where a.doctor_id = public.current_doctor_id()
            )
          )
        )
    )
  );
create policy "prescription_items_insert" on public.prescription_items
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from public.prescriptions p
      where p.id = prescription_id
        and (public.current_role() = 'doctor' and p.doctor_id = public.current_doctor_id())
    )
  );
create policy "prescription_items_admin" on public.prescription_items
  for update using (public.is_admin());

-- ----------------------------------------------------------------------------
-- invoices
-- ----------------------------------------------------------------------------
create policy "invoices_select" on public.invoices
  for select using (
    patient_id = auth.uid()
    or public.is_admin()
    or public.current_role() in ('pharmacist', 'doctor')
  );
create policy "invoices_insert" on public.invoices
  for insert with check (
    public.is_admin()
    or public.current_role() in ('doctor', 'pharmacist')
  );
create policy "invoices_update" on public.invoices
  for update using (
    public.is_admin()
    or public.current_role() in ('pharmacist', 'doctor')
  );
create policy "invoices_delete_admin" on public.invoices
  for delete using (public.is_admin());

-- ----------------------------------------------------------------------------
-- notifications
-- ----------------------------------------------------------------------------
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());
create policy "notifications_insert" on public.notifications
  for insert with check (
    public.is_admin()
    or user_id = auth.uid()
    or public.current_role() in ('doctor', 'pharmacist')
  );
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());
create policy "notifications_delete_admin" on public.notifications
  for delete using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Auto-decrement stock when a prescription is created (items inserted)
-- ----------------------------------------------------------------------------
create or replace function public.decrement_stock_on_prescription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.medications
     set stock_qty = greatest(0, stock_qty - new.quantity)
   where id = new.medication_id;
  return new;
end;
$$;

create trigger trg_decrement_stock
  after insert on public.prescription_items
  for each row execute function public.decrement_stock_on_prescription();

-- ----------------------------------------------------------------------------
-- Realtime: prescriptions, appointments, notifications
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.prescriptions;
alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.notifications;
