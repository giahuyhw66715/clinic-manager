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
  'pending', 'confirmed', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show'
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
  created_at timestamptz not null default now()
);

create unique index appointments_active_slot_key
  on public.appointments (doctor_id, appointment_date, time_slot)
  where status in ('pending', 'confirmed', 'checked-in', 'in-progress');

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

-- Patients can only see their own appointments via RLS, so expose only the
-- already-taken time slots of a doctor (no patient data leaks).
create or replace function public.get_booked_slots(target_doctor_id uuid, target_date date)
returns setof text
language sql
security definer
set search_path = public
as $$
  select time_slot::text
  from public.appointments
  where doctor_id = target_doctor_id
    and appointment_date = target_date
    and status in ('pending', 'confirmed', 'checked-in', 'in-progress');
$$;

revoke all on function public.get_booked_slots(uuid, date) from public;
grant execute on function public.get_booked_slots(uuid, date) to authenticated;

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
-- ============================================================================
-- ClinicManager - Seed data (sample accounts, departments, doctors, catalog)
-- Sample login credentials (change in production):
--   admin@clinic.test      / Password123!
--   doctor1@clinic.test    / Password123!
--   doctor2@clinic.test    / Password123!
--   doctor3@clinic.test    / Password123!
--   pharmacist@clinic.test / Password123!
--   patient1@clinic.test   / Password123!
--   patient2@clinic.test   / Password123!
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Auth users (the handle_new_user trigger creates matching profile rows)
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
   'admin@clinic.test', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Alex Admin"}', now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
   'doctor1@clinic.test', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Mai Nguyen"}', now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated',
   'doctor2@clinic.test', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. John Carter"}', now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated',
   'doctor3@clinic.test', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Sarah Kim"}', now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated',
   'pharmacist@clinic.test', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Nurse Lena"}', now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated',
   'patient1@clinic.test', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Peter Parker"}', now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated',
   'patient2@clinic.test', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Mary Watson"}', now(), now(), '', '', '', '', '');

-- ----------------------------------------------------------------------------
-- Profiles (roles + contact details)
-- ----------------------------------------------------------------------------
update public.profiles set role = 'admin',      phone = '+1 555 010 0000' where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set role = 'doctor',     phone = '+1 555 010 1001' where id = '22222222-2222-4222-8222-222222222222';
update public.profiles set role = 'doctor',     phone = '+1 555 010 1002' where id = '33333333-3333-4333-8333-333333333333';
update public.profiles set role = 'doctor',     phone = '+1 555 010 1003' where id = '44444444-4444-4444-8444-444444444444';
update public.profiles set role = 'pharmacist', phone = '+1 555 010 2001' where id = '55555555-5555-4555-8555-555555555555';
update public.profiles set role = 'patient',    phone = '+1 555 010 3001' where id = '66666666-6666-4666-8666-666666666666';
update public.profiles set role = 'patient',    phone = '+1 555 010 3002' where id = '77777777-7777-4777-8777-777777777777';

-- ----------------------------------------------------------------------------
-- Departments
-- ----------------------------------------------------------------------------
insert into public.departments (name, description) values
  ('Khoa Nội tổng hợp', 'Khám và chăm sóc sức khỏe tổng quát'),
  ('Khoa Tim mạch', 'Khám và điều trị các bệnh tim mạch'),
  ('Khoa Nhi', 'Chăm sóc sức khỏe và phát triển của trẻ em'),
  ('Khoa Da liễu', 'Chăm sóc da, tóc và móng');

-- ----------------------------------------------------------------------------
-- Doctors
-- ----------------------------------------------------------------------------
insert into public.doctors (id, user_id, department_id, specialty, consultation_fee, bio) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222',
   (select id from public.departments where name = 'Khoa Nội tổng hợp'),
   'Bác sĩ đa khoa', 1250000, 'Y học gia đình, nội khoa tổng quát.'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333',
   (select id from public.departments where name = 'Khoa Tim mạch'),
   'Bác sĩ tim mạch', 2250000, 'Bệnh tim, tăng huyết áp, đọc điện tim.'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '44444444-4444-4444-8444-444444444444',
   (select id from public.departments where name = 'Khoa Nhi'),
   'Bác sĩ nhi khoa', 1875000, 'Chăm sóc trẻ từ sơ sinh đến tuổi vị thành niên.');

-- ----------------------------------------------------------------------------
-- Doctor schedules (Mon-Fri 08:00-17:00, Sat 08:00-12:00, 30 min slots)
-- ----------------------------------------------------------------------------
insert into public.doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_minutes)
select d.id, s.day, s.start::time, s."end"::time, 30
from (values
  (0, '08:00', '12:00'),
  (1, '08:00', '17:00'),
  (2, '08:00', '17:00'),
  (3, '08:00', '17:00'),
  (4, '08:00', '17:00'),
  (5, '08:00', '17:00'),
  (6, '08:00', '12:00')
) as s(day, start, "end")
cross join public.doctors d;

-- ----------------------------------------------------------------------------
-- Medications
-- ----------------------------------------------------------------------------
insert into public.medications (name, description, dosage_unit, price, stock_qty, reorder_level) values
  ('Paracetamol 500mg', 'Giảm đau và hạ sốt', 'viên', 62500, 500, 50),
  ('Ibuprofen 400mg', 'Giảm đau chống viêm', 'viên', 75000, 300, 40),
  ('Amoxicillin 500mg', 'Kháng sinh (nhóm penicillin)', 'viên nang', 100000, 200, 30),
  ('Azithromycin 250mg', 'Kháng sinh macrolid', 'viên', 162500, 120, 20),
  ('Loratadine 10mg', 'Thuốc kháng histamin trị dị ứng', 'viên', 45000, 250, 30),
  ('Metformin 500mg', 'Thuốc điều trị tiểu đường type 2', 'viên', 50000, 180, 25),
  ('Amlodipine 5mg', 'Thuốc huyết áp', 'viên', 62500, 150, 20),
  ('Salbutamol Inhaler', 'Thuốc xịt hen suyễn', 'ống hít', 200000, 60, 10),
  ('Omeprazole 20mg', 'Thuốc trị trào ngược dạ dày', 'viên nang', 87500, 200, 25),
  ('Aspirin 81mg', 'Chống đông / giảm đau', 'viên', 37500, 400, 50),
  ('Warfarin 5mg', 'Thuốc chống đông máu', 'viên', 50000, 100, 15),
  ('Cetirizine 10mg', 'Thuốc kháng histamin', 'viên', 47500, 220, 30);

-- ----------------------------------------------------------------------------
-- Drug interactions
-- ----------------------------------------------------------------------------
insert into public.drug_interactions (medication_a_id, medication_b_id, severity, description)
values
  ((select id from public.medications where name = 'Aspirin 81mg'),
   (select id from public.medications where name = 'Warfarin 5mg'),
   'severe', 'Significantly increased risk of bleeding'),
  ((select id from public.medications where name = 'Ibuprofen 400mg'),
   (select id from public.medications where name = 'Warfarin 5mg'),
   'severe', 'Increased bleeding risk; avoid combination'),
  ((select id from public.medications where name = 'Amoxicillin 500mg'),
   (select id from public.medications where name = 'Warfarin 5mg'),
   'moderate', 'May enhance the anticoagulant effect'),
  ((select id from public.medications where name = 'Aspirin 81mg'),
   (select id from public.medications where name = 'Ibuprofen 400mg'),
   'mild', 'Reduced cardioprotective effect of aspirin');

-- ----------------------------------------------------------------------------
-- Patient allergies
-- ----------------------------------------------------------------------------
insert into public.patient_allergies (patient_id, medication_id, allergen, severity)
values ('66666666-6666-4666-8666-666666666666',
        (select id from public.medications where name = 'Amoxicillin 500mg'),
        'Penicillin', 'moderate');

-- ----------------------------------------------------------------------------
-- Appointments
-- ----------------------------------------------------------------------------
insert into public.appointments (patient_id, doctor_id, appointment_date, time_slot, reason, status) values
  ('66666666-6666-4666-8666-666666666666', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   current_date, '09:00'::time, 'Cough and fever for 3 days', 'confirmed'),
  ('77777777-7777-4777-8777-777777777777', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   current_date, '10:30'::time, 'Annual heart checkup', 'pending'),
  ('66666666-6666-4666-8666-666666666666', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   current_date, '14:00'::time, 'Skin rash on arms', 'pending'),
  ('77777777-7777-4777-8777-777777777777', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   current_date + 1, '09:00'::time, 'Follow-up on blood tests', 'confirmed');

-- ----------------------------------------------------------------------------
-- Past medical record for patient1
-- ----------------------------------------------------------------------------
insert into public.medical_records (appointment_id, patient_id, doctor_id, symptoms, diagnosis, treatment_plan, created_at)
values (null, '66666666-6666-4666-8666-666666666666', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Productive cough, mild fever',
        'Acute bronchitis',
        'Rest, fluids, paracetamol for fever. Review in 1 week if no improvement.',
        now() - interval '30 days');

-- ----------------------------------------------------------------------------
-- Past delivered prescription for patient1 (stock auto-decremented by trigger)
-- ----------------------------------------------------------------------------
insert into public.prescriptions (id, appointment_id, patient_id, doctor_id, status, notes, created_at)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', null, '66666666-6666-4666-8666-666666666666',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'delivered', 'Take after meals.', now() - interval '5 days');

insert into public.prescription_items (prescription_id, medication_id, dosage, quantity, instructions) values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', (select id from public.medications where name = 'Paracetamol 500mg'), '500mg 3x daily', 20, 'After meals'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', (select id from public.medications where name = 'Azithromycin 250mg'), '250mg 1x daily', 10, 'Morning, 1h before food');

-- ----------------------------------------------------------------------------
-- Invoice for patient1 (paid)
-- ----------------------------------------------------------------------------
insert into public.invoices (appointment_id, patient_id, total_amount, paid, paid_at, created_at)
values (null, '66666666-6666-4666-8666-666666666666', 140.00, true, now() - interval '5 days', now() - interval '5 days');

-- ----------------------------------------------------------------------------
-- A couple of notifications for patient1
-- ----------------------------------------------------------------------------
insert into public.notifications (user_id, type, title, body) values
  ('66666666-6666-4666-8666-666666666666', 'appointment', 'Appointment booked',
   'Your appointment with Dr. Mai Nguyen is confirmed for today at 09:00.'),
  ('66666666-6666-4666-8666-666666666666', 'record', 'Visit completed',
   'Your visit record was saved and an invoice was created.');
-- ============================================================================
-- ClinicManager - Daily appointment reminders (in-app notifications)
-- Schedules a pg_cron job that runs daily at 00:00 Vietnam time (17:00 UTC) and
-- notifies patients who have a confirmed/pending appointment tomorrow.
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
    and a.status in ('pending', 'confirmed');
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
-- ============================================================================
-- ClinicManager - Auto-mark no-show
-- Schedules a pg_cron job that runs daily at 00:00 Vietnam time (17:00 UTC) and
-- marks appointments from previous days that were never completed/cancelled as
-- no-show. This keeps the doctor queue and patient appointment list free of
-- stale "confirmed" rows.
-- ============================================================================

create extension if not exists pg_cron with schema pg_catalog;

alter table public.appointments add column cancel_reason text;

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

-- Enable the cron schedule (runs daily at 00:00 Vietnam time / 17:00 UTC).
-- On the Supabase free tier, projects pause after 7 days of inactivity, which
-- also pauses cron jobs. Regular usage keeps the project active.
select cron.schedule(
  'mark-no-show-stale-appointments',
  '0 17 * * *',
  $$ select public.mark_no_show_stale_appointments(); $$
);