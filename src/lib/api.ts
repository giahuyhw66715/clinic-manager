import { supabase } from "@/lib/supabase";
import { toDateKey, todayDateKey } from "@/lib/utils";
import type {
  Appointment,
  Department,
  Doctor,
  DoctorOffDay,
  DoctorSchedule,
  DrugInteraction,
  Invoice,
  MedicalRecord,
  Medication,
  PatientAllergy,
  Prescription,
  PrescriptionWithItems,
  Profile,
} from "@/types";

const doctorSelect = "id,user_id,department_id,specialty,bio,consultation_fee,profile:profiles(id,full_name,email,phone),department:departments(id,name)";
const appointmentSelect = `id,patient_id,doctor_id,appointment_date,time_slot,reason,status,paid,notes,cancel_reason,created_at,
  doctor:doctors(id,user_id,department_id,specialty,bio,consultation_fee,profile:profiles(id,full_name,email,phone),department:departments(id,name)),
  patient:profiles(id,full_name,email,phone,allergies)`;

function getErrorMessage(error: { message?: string }): never {
  throw new Error(error.message ?? "Something went wrong");
}

/* ---------------------------------- Shared --------------------------------- */

export async function getDepartments(): Promise<Department[]> {
  const { data, error } = await supabase.from("departments").select("*").order("name");
  if (error) getErrorMessage(error);
  return (data ?? []) as Department[];
}

export async function createDepartment(input: { name: string; description?: string }): Promise<void> {
  const { error } = await supabase.from("departments").insert({
    name: input.name,
    description: input.description ?? null,
  });
  if (error) getErrorMessage(error);
}

export async function updateDepartment(
  id: string,
  input: { name: string; description?: string },
): Promise<void> {
  const { error } = await supabase
    .from("departments")
    .update({ name: input.name, description: input.description ?? null })
    .eq("id", id);
  if (error) getErrorMessage(error);
}

export async function deleteDepartment(id: string): Promise<void> {
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) getErrorMessage(error);
}

export async function getMedications(): Promise<Medication[]> {
  const { data, error } = await supabase.from("medications").select("*").order("name");
  if (error) getErrorMessage(error);
  return (data ?? []) as Medication[];
}

export async function createMedication(
  input: Partial<Medication> & { name: string },
): Promise<void> {
  const { error } = await supabase.from("medications").insert(input);
  if (error) getErrorMessage(error);
}

export async function updateMedication(id: string, input: Partial<Medication>): Promise<void> {
  const { error } = await supabase.from("medications").update(input).eq("id", id);
  if (error) getErrorMessage(error);
}

export async function deleteMedication(id: string): Promise<void> {
  const { error } = await supabase.from("medications").delete().eq("id", id);
  if (error) getErrorMessage(error);
}

/* --------------------------------- Doctors --------------------------------- */

export async function getDoctors(): Promise<Doctor[]> {
  const { data, error } = await supabase.from("doctors").select(doctorSelect).order("specialty");
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as Doctor[];
}

export async function getDoctorsByDepartment(departmentId: string): Promise<Doctor[]> {
  const { data, error } = await supabase
    .from("doctors")
    .select(doctorSelect)
    .eq("department_id", departmentId)
    .order("specialty");
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as Doctor[];
}

export async function getDoctorByUserId(userId: string): Promise<Doctor | null> {
  const { data, error } = await supabase
    .from("doctors")
    .select(doctorSelect)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) getErrorMessage(error);
  return (data ?? null) as unknown as Doctor | null;
}

export async function createDoctor(input: {
  user_id: string;
  department_id: string;
  specialty: string;
  consultation_fee: number;
  bio?: string;
}): Promise<void> {
  const { data, error } = await supabase
    .from("doctors")
    .insert({
      user_id: input.user_id,
      department_id: input.department_id,
      specialty: input.specialty,
      consultation_fee: input.consultation_fee,
      bio: input.bio ?? null,
    })
    .select("id")
    .single();
  if (error) getErrorMessage(error);
  const doctorId = (data as { id: string } | null)?.id;
  if (!doctorId) return;

  const defaultSchedules = [
    { doctor_id: doctorId, day_of_week: 0, start_time: "08:00", end_time: "12:00", slot_minutes: 30 },
    { doctor_id: doctorId, day_of_week: 1, start_time: "08:00", end_time: "17:00", slot_minutes: 30 },
    { doctor_id: doctorId, day_of_week: 2, start_time: "08:00", end_time: "17:00", slot_minutes: 30 },
    { doctor_id: doctorId, day_of_week: 3, start_time: "08:00", end_time: "17:00", slot_minutes: 30 },
    { doctor_id: doctorId, day_of_week: 4, start_time: "08:00", end_time: "17:00", slot_minutes: 30 },
    { doctor_id: doctorId, day_of_week: 5, start_time: "08:00", end_time: "17:00", slot_minutes: 30 },
    { doctor_id: doctorId, day_of_week: 6, start_time: "08:00", end_time: "12:00", slot_minutes: 30 },
  ];
  const { error: schedError } = await supabase.from("doctor_schedules").insert(defaultSchedules);
  if (schedError) getErrorMessage(schedError);
}

export async function updateDoctor(id: string, input: Partial<Doctor>): Promise<void> {
  const { error } = await supabase.from("doctors").update(input).eq("id", id);
  if (error) getErrorMessage(error);
}

export async function deleteDoctor(id: string): Promise<void> {
  const { error } = await supabase.from("doctors").delete().eq("id", id);
  if (error) getErrorMessage(error);
}

/* ------------------------------- Schedules -------------------------------- */

export async function getDoctorSchedules(doctorId: string): Promise<DoctorSchedule[]> {
  const { data, error } = await supabase
    .from("doctor_schedules")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("day_of_week");
  if (error) getErrorMessage(error);
  return (data ?? []) as DoctorSchedule[];
}

export async function upsertDoctorSchedule(
  schedule: Omit<DoctorSchedule, "id"> & { id?: string },
): Promise<void> {
  const { error } = await supabase
    .from("doctor_schedules")
    .upsert(schedule, { onConflict: "doctor_id,day_of_week" });
  if (error) getErrorMessage(error);
}

export async function deleteDoctorSchedule(id: string): Promise<void> {
  const { error } = await supabase.from("doctor_schedules").delete().eq("id", id);
  if (error) getErrorMessage(error);
}

export async function getDoctorOffDays(doctorId: string): Promise<DoctorOffDay[]> {
  const { data, error } = await supabase
    .from("doctor_off_days")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("off_date");
  if (error) getErrorMessage(error);
  return (data ?? []) as DoctorOffDay[];
}

export async function createDoctorOffDay(input: {
  doctor_id: string;
  off_date: string;
  reason?: string;
}): Promise<void> {
  const { error } = await supabase
    .from("doctor_off_days")
    .insert({ doctor_id: input.doctor_id, off_date: input.off_date, reason: input.reason ?? null });
  if (error) getErrorMessage(error);
}

export async function deleteDoctorOffDay(id: string): Promise<void> {
  const { error } = await supabase.from("doctor_off_days").delete().eq("id", id);
  if (error) getErrorMessage(error);
}

/* ------------------------------ Appointments ------------------------------ */

export async function createAppointment(input: {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  time_slot: string;
  reason?: string;
}): Promise<void> {
  const { error } = await supabase.from("appointments").insert({
    patient_id: input.patient_id,
    doctor_id: input.doctor_id,
    appointment_date: input.appointment_date,
    time_slot: input.time_slot,
    reason: input.reason ?? null,
    status: "pending",
  });
  if (error) getErrorMessage(error);
}

export async function updateAppointmentStatus(
  id: string,
  status: Appointment["status"],
  cancelReason?: string,
): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update(cancelReason ? { status, cancel_reason: cancelReason } : { status })
    .eq("id", id);
  if (error) getErrorMessage(error);
}

export async function updateAppointmentSchedule(
  id: string,
  appointmentDate: string,
  timeSlot: string,
): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update({ appointment_date: appointmentDate, time_slot: timeSlot, status: "pending" })
    .eq("id", id);
  if (error) getErrorMessage(error);
}

export async function getMyAppointments(patientId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("patient_id", patientId)
    .order("appointment_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as Appointment[];
}

export async function getUpcomingMyAppointments(patientId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("patient_id", patientId)
    .gte("appointment_date", todayDateKey())
    .order("appointment_date")
    .order("time_slot");
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as Appointment[];
}

export async function getDoctorAppointments(doctorId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("doctor_id", doctorId)
    .order("appointment_date", { ascending: false });
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as Appointment[];
}

export async function getDoctorNoShowCancelled(doctorId: string): Promise<Appointment[]> {
  const since = new Date();
  since.setDate(since.getDate() - 29);
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("doctor_id", doctorId)
    .in("status", ["no-show", "cancelled"])
    .gte("appointment_date", toDateKey(since))
    .order("appointment_date", { ascending: false })
    .order("time_slot");
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as Appointment[];
}

export async function getTodayDoctorAppointments(doctorId: string): Promise<Appointment[]> {
  const today = todayDateKey();
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("doctor_id", doctorId)
    .eq("appointment_date", today)
    .in("status", ["confirmed", "checked-in", "in-progress", "pending", "no-show"])
    .order("time_slot", { ascending: true });
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as Appointment[];
}

export async function getDoctorCompletedAppointments(doctorId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("doctor_id", doctorId)
    .eq("status", "completed")
    .order("appointment_date")
    .order("time_slot", { ascending: true });
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as Appointment[];
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) getErrorMessage(error);
  return (data ?? null) as Appointment | null;
}

export async function getBookedSlots(doctorId: string, date: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_booked_slots", {
    target_doctor_id: doctorId,
    target_date: date,
  });
  if (error) getErrorMessage(error);
  return (data ?? []) as string[];
}

export async function getTodayAppointmentsForCheckIn(): Promise<Appointment[]> {
  const today = todayDateKey();
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentSelect)
    .eq("appointment_date", today)
    .in("status", ["pending", "confirmed", "checked-in", "in-progress"])
    .order("time_slot");
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as Appointment[];
}

/* ----------------------------- Medical records ----------------------------- */

export async function createMedicalRecord(input: {
  appointment_id: string | null;
  patient_id: string;
  doctor_id: string;
  symptoms?: string;
  diagnosis?: string;
  notes?: string;
  treatment_plan?: string;
}): Promise<void> {
  const { error } = await supabase.from("medical_records").insert({
    appointment_id: input.appointment_id,
    patient_id: input.patient_id,
    doctor_id: input.doctor_id,
    symptoms: input.symptoms ?? null,
    diagnosis: input.diagnosis ?? null,
    notes: input.notes ?? null,
    treatment_plan: input.treatment_plan ?? null,
  });
  if (error) getErrorMessage(error);
}

export async function getPatientMedicalRecords(patientId: string): Promise<MedicalRecord[]> {
  const { data, error } = await supabase
    .from("medical_records")
    .select(
      "id,appointment_id,patient_id,doctor_id,symptoms,diagnosis,notes,treatment_plan,created_at,doctor:doctors(id,user_id,specialty,profile:profiles(id,full_name))",
    )
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as MedicalRecord[];
}

export async function getPatientRecentRecords(patientId: string, limit = 10): Promise<MedicalRecord[]> {
  const { data, error } = await supabase
    .from("medical_records")
    .select("id,appointment_id,patient_id,doctor_id,symptoms,diagnosis,notes,treatment_plan,created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as MedicalRecord[];
}

/* ------------------------------ Prescriptions ----------------------------- */

const prescriptionSelect = (withPatient: boolean) =>
  `id,appointment_id,patient_id,doctor_id,status,notes,created_at,
   doctor:doctors(id,user_id,specialty,profile:profiles(id,full_name)),
   items:prescription_items(id,prescription_id,medication_id,dosage,quantity,instructions,medication:medications(id,name,price,stock_qty,reorder_level,dosage_unit,description))${
     withPatient ? ",patient:profiles(id,full_name,email,phone,allergies)" : ""
   }`;

export async function createPrescription(input: {
  appointment_id: string | null;
  patient_id: string;
  doctor_id: string;
  notes?: string;
  items: { medication_id: string; dosage?: string; quantity: number; instructions?: string }[];
}): Promise<void> {
  const { data: prescription, error: presError } = await supabase
    .from("prescriptions")
    .insert({
      appointment_id: input.appointment_id,
      patient_id: input.patient_id,
      doctor_id: input.doctor_id,
      notes: input.notes ?? null,
      status: "sent",
    })
    .select("id")
    .single();
  if (presError) getErrorMessage(presError);

  const rows = input.items.map((item) => ({
    prescription_id: prescription.id,
    medication_id: item.medication_id,
    dosage: item.dosage ?? null,
    quantity: item.quantity,
    instructions: item.instructions ?? null,
  }));
  const { error: itemsError } = await supabase.from("prescription_items").insert(rows);
  if (itemsError) getErrorMessage(itemsError);
}

export async function getMyPrescriptions(patientId: string): Promise<PrescriptionWithItems[]> {
  const { data, error } = await supabase
    .from("prescriptions")
    .select(prescriptionSelect(false))
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as PrescriptionWithItems[];
}

export async function getPatientPrescriptions(patientId: string): Promise<PrescriptionWithItems[]> {
  const { data, error } = await supabase
    .from("prescriptions")
    .select(prescriptionSelect(false))
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as PrescriptionWithItems[];
}

export async function getAppointmentPrescriptions(
  appointmentId: string,
): Promise<PrescriptionWithItems[]> {
  const { data, error } = await supabase
    .from("prescriptions")
    .select(
      `id,appointment_id,patient_id,doctor_id,status,notes,created_at,
       items:prescription_items(id,prescription_id,medication_id,dosage,quantity,instructions,medication:medications(id,name,price))`,
    )
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false });
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as PrescriptionWithItems[];
}

export async function getPharmacyPrescriptions(): Promise<PrescriptionWithItems[]> {
  const { data, error } = await supabase
    .from("prescriptions")
    .select(prescriptionSelect(true))
    .order("created_at", { ascending: true });
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as PrescriptionWithItems[];
}

export async function getPrescriptionById(id: string): Promise<PrescriptionWithItems | null> {
  const { data, error } = await supabase
    .from("prescriptions")
    .select(
      `id,appointment_id,patient_id,doctor_id,status,notes,created_at,
       doctor:doctors(id,user_id,specialty,profile:profiles(id,full_name)),
       items:prescription_items(id,prescription_id,medication_id,dosage,quantity,instructions,medication:medications(id,name,price,stock_qty,reorder_level,dosage_unit,description)),
       patient:profiles(id,full_name,email,phone,allergies)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) getErrorMessage(error);
  return (data ?? null) as PrescriptionWithItems | null;
}

export async function updatePrescriptionStatus(
  id: string,
  status: Prescription["status"],
): Promise<void> {
  const { error } = await supabase.from("prescriptions").update({ status }).eq("id", id);
  if (error) getErrorMessage(error);
}

/* -------------------------------- Invoices --------------------------------- */

export async function createInvoice(input: {
  appointment_id: string;
  patient_id: string;
  total_amount: number;
}): Promise<void> {
  const { error } = await supabase.from("invoices").insert({
    appointment_id: input.appointment_id,
    patient_id: input.patient_id,
    total_amount: input.total_amount,
    paid: false,
  });
  if (error) getErrorMessage(error);
}

export async function markInvoicePaid(id: string): Promise<void> {
  const { error } = await supabase.from("invoices").update({ paid_at: new Date().toISOString(), paid: true }).eq("id", id);
  if (error) getErrorMessage(error);
}

export async function getMyInvoices(patientId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id,appointment_id,patient_id,total_amount,paid,paid_at,created_at,appointment:appointments(id,appointment_date,time_slot,doctor:doctors(id,specialty,consultation_fee,profile:profiles(id,full_name)))",
    )
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) getErrorMessage(error);
  return (data ?? []) as unknown as Invoice[];
}

/* ------------------------------ Interactions ------------------------------- */

export async function getPatientAllergies(patientId: string): Promise<PatientAllergy[]> {
  const { data, error } = await supabase
    .from("patient_allergies")
    .select("*,medication:medications(id,name)")
    .eq("patient_id", patientId);
  if (error) getErrorMessage(error);
  return (data ?? []) as PatientAllergy[];
}

export async function getDrugInteractions(): Promise<DrugInteraction[]> {
  const { data, error } = await supabase
    .from("drug_interactions")
    .select("*,medication_a:medications(id,name),medication_b:medications(id,name)");
  if (error) getErrorMessage(error);
  return (data ?? []) as DrugInteraction[];
}

/* --------------------------------- Admin ---------------------------------- */

export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at");
  if (error) getErrorMessage(error);
  return (data ?? []) as Profile[];
}

export async function updateProfileRole(userId: string, role: Profile["role"]): Promise<void> {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) getErrorMessage(error);
}

export async function searchProfiles(search: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
    .order("created_at")
    .limit(50);
  if (error) getErrorMessage(error);
  return (data ?? []) as Profile[];
}

export async function getRevenueStats(): Promise<{
  total: number;
  paid: number;
  unpaid: number;
  invoiceCount: number;
}> {
  const { data, error } = await supabase.from("invoices").select("total_amount,paid");
  if (error) getErrorMessage(error);
  const rows = (data ?? []) as { total_amount: number; paid: boolean }[];
  return {
    total: rows.reduce((s, r) => s + Number(r.total_amount), 0),
    paid: rows.reduce((s, r) => s + (r.paid ? Number(r.total_amount) : 0), 0),
    unpaid: rows.filter((r) => !r.paid).length,
    invoiceCount: rows.length,
  };
}