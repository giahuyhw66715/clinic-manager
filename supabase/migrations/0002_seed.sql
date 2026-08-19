-- ============================================================================
-- ClinicManager - Seed data (sample accounts, departments, doctors, catalog)
-- Sample login credentials (change in production):
--   alex.admin@clinic.vn     / Password123!   (admin)
--   mai.nguyen@clinic.vn     / Password123!   (doctor)
--   john.carter@clinic.vn    / Password123!   (doctor)
--   sarah.kim@clinic.vn      / Password123!   (doctor)
--   lena@clinic.vn           / Password123!   (pharmacist)
--   peter.parker@gmail.com   / Password123!   (patient)
--   mary.watson@gmail.com    / Password123!   (patient)
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
   'alex.admin@clinic.vn', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Alex Admin"}', now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
   'mai.nguyen@clinic.vn', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Mai Nguyen"}', now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated',
   'john.carter@clinic.vn', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. John Carter"}', now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated',
   'sarah.kim@clinic.vn', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Sarah Kim"}', now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated',
   'lena@clinic.vn', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Nurse Lena"}', now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated',
   'peter.parker@gmail.com', crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Peter Parker"}', now(), now(), '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated',
   'mary.watson@gmail.com', crypt('Password123!', gen_salt('bf')), now(),
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
  ('General Medicine', 'Primary care and general consultations'),
  ('Cardiology', 'Heart and cardiovascular care'),
  ('Pediatrics', 'Child health and development'),
  ('Dermatology', 'Skin, hair and nails');

-- ----------------------------------------------------------------------------
-- Doctors
-- ----------------------------------------------------------------------------
insert into public.doctors (id, user_id, department_id, specialty, consultation_fee, bio) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222',
   (select id from public.departments where name = 'General Medicine'),
   'General Practitioner', 50, 'Family medicine, internal medicine.'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333',
   (select id from public.departments where name = 'Cardiology'),
   'Cardiologist', 90, 'Heart disease, hypertension, ECG interpretation.'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '44444444-4444-4444-8444-444444444444',
   (select id from public.departments where name = 'Pediatrics'),
   'Pediatrician', 75, 'Child care from newborns to adolescents.');

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
  ('Paracetamol 500mg', 'Pain relief and fever reduction', 'tablet', 2.50, 500, 50),
  ('Ibuprofen 400mg', 'Anti-inflammatory pain relief', 'tablet', 3.00, 300, 40),
  ('Amoxicillin 500mg', 'Antibiotic (penicillin family)', 'capsule', 4.00, 200, 30),
  ('Azithromycin 250mg', 'Macrolide antibiotic', 'tablet', 6.50, 120, 20),
  ('Loratadine 10mg', 'Antihistamine for allergies', 'tablet', 1.80, 250, 30),
  ('Metformin 500mg', 'Type 2 diabetes medication', 'tablet', 2.00, 180, 25),
  ('Amlodipine 5mg', 'Blood pressure medication', 'tablet', 2.50, 150, 20),
  ('Salbutamol Inhaler', 'Asthma reliever inhaler', 'inhaler', 8.00, 60, 10),
  ('Omeprazole 20mg', 'Acid reflux medication', 'capsule', 3.50, 200, 25),
  ('Aspirin 81mg', 'Blood thinner / pain relief', 'tablet', 1.50, 400, 50),
  ('Warfarin 5mg', 'Anticoagulant', 'tablet', 2.00, 100, 15),
  ('Cetirizine 10mg', 'Antihistamine', 'tablet', 1.90, 220, 30);

-- ----------------------------------------------------------------------------
-- Drug interactions
-- ----------------------------------------------------------------------------
insert into public.drug_interactions (medication_a_id, medication_b_id, severity, description)
values
  ((select id from public.medications where name = 'Aspirin 81mg'),
   (select id from public.medications where name = 'Warfarin 5mg'),
   'severe', 'Tăng đáng kể nguy cơ chảy máu khi dùng chung'),
  ((select id from public.medications where name = 'Ibuprofen 400mg'),
   (select id from public.medications where name = 'Warfarin 5mg'),
   'severe', 'Tăng nguy cơ chảy máu; tránh phối hợp'),
  ((select id from public.medications where name = 'Amoxicillin 500mg'),
   (select id from public.medications where name = 'Warfarin 5mg'),
   'moderate', 'Có thể làm tăng tác dụng chống đông máu'),
  ((select id from public.medications where name = 'Aspirin 81mg'),
   (select id from public.medications where name = 'Ibuprofen 400mg'),
   'mild', 'Giảm tác dụng bảo vệ tim mạch của aspirin');

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
   current_date, '09:00'::time, 'Cough and fever for 3 days', 'pending'),
  ('77777777-7777-4777-8777-777777777777', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   current_date, '10:30'::time, 'Annual heart checkup', 'pending'),
  ('66666666-6666-4666-8666-666666666666', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   current_date, '14:00'::time, 'Skin rash on arms', 'pending'),
  ('77777777-7777-4777-8777-777777777777', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   current_date + 1, '09:00'::time, 'Follow-up on blood tests', 'pending');

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
   'Your appointment with Dr. Mai Nguyen is booked for today at 09:00.'),
  ('66666666-6666-4666-8666-666666666666', 'record', 'Visit completed',
   'Your visit record was saved and an invoice was created.');
