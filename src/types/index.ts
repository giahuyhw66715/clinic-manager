export type UserRole = "patient" | "doctor" | "pharmacist" | "admin";

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "checked-in"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "no-show";

export type PrescriptionStatus = "sent" | "preparing" | "ready" | "delivered";

export type Severity = "mild" | "moderate" | "severe";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  allergies: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Doctor {
  id: string;
  user_id: string;
  department_id: string | null;
  specialty: string | null;
  bio: string | null;
  consultation_fee: number;
  created_at: string;
  // joined
  profile?: Profile;
  department?: Department | null;
}

export interface DoctorSchedule {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
}

export interface DoctorOffDay {
  id: string;
  doctor_id: string;
  off_date: string;
  reason: string | null;
}

export interface Medication {
  id: string;
  name: string;
  description: string | null;
  dosage_unit: string | null;
  price: number;
  stock_qty: number;
  reorder_level: number;
  created_at: string;
}

export interface DrugInteraction {
  id: string;
  medication_a_id: string;
  medication_b_id: string;
  severity: Severity;
  description: string | null;
  medication_a?: Medication;
  medication_b?: Medication;
}

export interface PatientAllergy {
  id: string;
  patient_id: string;
  medication_id: string | null;
  allergen: string | null;
  severity: Severity;
  medication?: Medication | null;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  time_slot: string;
  reason: string | null;
  status: AppointmentStatus;
  paid: boolean;
  notes: string | null;
  cancel_reason: string | null;
  created_at: string;
  // joined
  doctor?: Doctor & { profile?: Profile; department?: Department | null } | null;
  patient?: Profile | null;
}

export interface MedicalRecord {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  doctor_id: string;
  symptoms: string | null;
  diagnosis: string | null;
  notes: string | null;
  treatment_plan: string | null;
  created_at: string;
  doctor?: Doctor & { profile?: Profile } | null;
}

export interface Prescription {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  doctor_id: string;
  status: PrescriptionStatus;
  notes: string | null;
  created_at: string;
}

export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  medication_id: string;
  dosage: string | null;
  quantity: number;
  instructions: string | null;
  medication?: Medication | null;
}

export interface PrescriptionWithItems extends Prescription {
  items: PrescriptionItem[];
  doctor?: Doctor & { profile?: Profile } | null;
  patient?: Profile | null;
  appointment?: Appointment | null;
}

export interface Invoice {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  total_amount: number;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
  appointment?: Appointment | null;
  patient?: Profile | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}