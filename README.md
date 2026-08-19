# ClinicManager - Clinic Management System

A complete clinic management system: appointment booking, medical examinations (SOAP), prescription management, pharmacy, invoices, and administration. The entire UI is in Vietnamese.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Forms & Validation**: React Hook Form + Zod
- **Data fetching / cache**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Backend**: Supabase (Auth, PostgreSQL, Row Level Security, Realtime, pg_cron)
- **PDF**: `@react-pdf/renderer` (invoice export, Roboto font with Vietnamese support)
- **Timezone**: the whole system operates in `Asia/Ho_Chi_Minh`

## Roles & Features

| Role | Main features |
|------|---------------|
| **Patient** (`patient`) | Book / reschedule / cancel appointments, view medical history, prescriptions, invoices (download PDF) |
| **Doctor** (`doctor`) | Manage daily appointments, examine & write SOAP notes, prescribe (with allergy + drug-interaction checks), complete visits (create invoice), manage patients, view working schedule |
| **Pharmacist** (`pharmacist`) | Check in patients, process prescriptions in a queue (prepare → ready → deliver), manage medication inventory |
| **Admin** (`admin`) | Dashboard (appointments, revenue), manage users & roles, doctors & schedules, departments, medications |

## Key Business Rules

- **Slot conflicts**: a patient cannot book two doctors within less than **1 hour** of each other (enforced client-side **and** by a DB trigger).
- **Prescription safety**: warns about patient allergies and drug interactions (mild / moderate / severe); quantity cannot exceed stock.
- **Auto no-show**: cron jobs mark appointments as `no-show` when 2 hours have passed since the slot (same day) and for previous days that were never completed; runs every minute + daily.
- **Auto-paid invoice**: when the pharmacist clicks "Đánh dấu đã bàn giao" (mark as delivered) on a prescription, the invoice for that appointment is automatically marked `Paid`.
- **Auto-decrement stock**: adding an item to a prescription decrements the medication's stock automatically (never below 0).

## Project Structure

```
clinic-manager/
├── src/
│   ├── components/          # UI (shadcn/ui) + shared components
│   ├── contexts/            # AuthContext (sign-in / profile)
│   ├── features/
│   │   ├── auth/            # Login / Register
│   │   ├── booking/         # Book appointment (department → doctor → date & time)
│   │   ├── patient/         # Appointments, medical history, prescriptions, invoices
│   │   ├── doctor/          # Queue, visit record (SOAP), prescription, patients, schedule
│   │   ├── pharmacist/      # Check-in, prescription queue, prescription detail, inventory
│   │   ├── admin/           # Dashboard, users, doctors, departments, medications
│   │   └── home/            # Landing page + role-based home
│   ├── hooks/               # useNotifications
│   ├── lib/                 # supabase client, api, availability, validation, utils
│   └── types/               # TypeScript types
├── supabase/
│   ├── apply_all.sql        # Schema + RLS + triggers + seed + cron (run everything)
│   ├── reset.sql            # Reset DB to a clean state (run before apply_all when needed)
│   ├── fix_auth_login.sql   # Fix for an earlier migration (email login)
│   └── migrations/          # 0001_schema ... 0007_invoice_paid_on_deliver
├── SPEC.md                  # Detailed feature & workflow documentation
└── package.json
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file (see `.env.example`):

```
VITE_SUPABASE_URL=<Supabase project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable/anon key>
```

### 3. Run the dev server

```bash
npm run dev          # http://localhost:5173
```

Other commands:

```bash
npm run build        # tsc -b && vite build (production build)
npm run preview      # preview the production build
npm run typecheck    # tsc -b --noEmit (strict type check)
```

## Database Setup (Supabase)

1. Create a Supabase project, copy the `URL` and `Publishable key` into `.env.local`.
2. Open **Supabase Dashboard → SQL Editor**:
   - **First time**: run the contents of `supabase/apply_all.sql` (schema + RLS + triggers + sample data + cron).
   - **Reset needed** (broken DB / old data): run `supabase/reset.sql` first, then `supabase/apply_all.sql` in a new query.
   - **Existing DB created before the login fix**: run `supabase/fix_auth_login.sql`.
   - **Incremental migrations**: run files in `supabase/migrations/` in order `0001 → 0007`.

### Seed accounts — shared password `Password123!`

| Email | Role |
|-------|------|
| `alex.admin@clinic.vn` | Admin |
| `mai.nguyen@clinic.vn` | Doctor |
| `john.carter@clinic.vn` | Doctor |
| `sarah.kim@clinic.vn` | Doctor |
| `lena@clinic.vn` | Pharmacist |
| `peter.parker@gmail.com` | Patient |
| `mary.watson@gmail.com` | Patient |

### Automation (pg_cron)

- `clinic-manager-mark-no-show`: every minute — marks same-day appointments as `no-show` when 2 hours have passed since the slot.
- `mark-no-show-stale-appointments`: daily — handles previous-day appointments that were never completed.
- `send-tomorrow-reminders`: daily — reminds patients about tomorrow's appointments.

Note: Supabase Free-tier projects pause after 7 days of inactivity, which also pauses cron jobs.

## Security & Permissions

- **Row Level Security (RLS)** is enabled on every table; patients only see their own data, doctors only see data related to their practice.
- The 1-hour gap between a patient's appointments is enforced by a **DB trigger** (`prevent_patient_2h_overlap`), not just on the client side.