import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, ClipboardList, Phone, Stethoscope, XCircle } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/PageHeader";
import { DetailSkeleton } from "@/components/shared/Skeletons";
import { AppointmentStatusBadge } from "@/components/shared/StatusBadge";
import { PrescriptionForm } from "@/features/doctor/components/PrescriptionForm";
import {
  createInvoice,
  createMedicalRecord,
  getAppointmentById,
  getAppointmentPrescriptions,
  getDoctorByUserId,
  getPatientMedicalRecords,
  getPatientAllergies,
  updateAppointmentStatus,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { createNotification } from "@/hooks/useNotifications";
import { cn, formatCurrency, formatDateTime, formatTime } from "@/lib/utils";
import { Link } from "react-router-dom";

const soapSchema = z.object({
  symptoms: z.string().max(300, "Symptoms must be under 300 characters").optional(),
  diagnosis: z.string().min(1, "Diagnosis is required").max(100, "Diagnosis must be under 100 characters"),
  treatment_plan: z.string().max(300, "Treatment plan must be under 300 characters").optional(),
  notes: z.string().max(300, "Notes must be under 300 characters").optional(),
});

type SoapValues = z.infer<typeof soapSchema>;

const steps = [
  { label: "Consultation record", value: "soap" },
  { label: "Prescription & complete", value: "prescription" },
] as const;

type Step = (typeof steps)[number]["value"];

export function PatientRecordPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("soap");
  const [cancelReason, setCancelReason] = useState("");

  const { data: appointment, isLoading } = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => getAppointmentById(appointmentId!),
    enabled: !!appointmentId,
  });
  const { data: doctor } = useQuery({
    queryKey: ["my-doctor", user?.id],
    queryFn: () => getDoctorByUserId(user!.id),
    enabled: !!user,
  });
  const { data: records = [] } = useQuery({
    queryKey: ["patient-records", appointment?.patient_id],
    queryFn: () => getPatientMedicalRecords(appointment!.patient_id),
    enabled: !!appointment,
  });
  const { data: allergies = [] } = useQuery({
    queryKey: ["patient-allergies", appointment?.patient_id],
    queryFn: () => getPatientAllergies(appointment!.patient_id),
    enabled: !!appointment,
  });
  const { data: prescriptions = [] } = useQuery({
    queryKey: ["appointment-prescriptions", appointmentId],
    queryFn: () => getAppointmentPrescriptions(appointmentId!),
    enabled: !!appointmentId,
  });

  const form = useForm<SoapValues>({
    resolver: zodResolver(soapSchema),
    defaultValues: { symptoms: "", diagnosis: "", treatment_plan: "", notes: "" },
  });
  const diagnosis = form.watch("diagnosis");

  const saveSoapMutation = useMutation({
    mutationFn: async (values: SoapValues) => {
      if (!appointment || !doctor) throw new Error("Missing context");
      const alreadySaved = records.some((r) => r.appointment_id === appointment.id);
      if (!alreadySaved) {
        await createMedicalRecord({
          appointment_id: appointment.id,
          patient_id: appointment.patient_id,
          doctor_id: doctor.id,
          symptoms: values.symptoms,
          diagnosis: values.diagnosis,
          treatment_plan: values.treatment_plan,
          notes: values.notes,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-records"] });
    },
    onError: () => {
      throw new Error("Failed to save consultation record");
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!appointment || !doctor) throw new Error("Missing context");
      const values = form.getValues();
      await saveSoapMutation.mutateAsync(values);
      const rx = await getAppointmentPrescriptions(appointment.id);
      if (rx.length === 0) {
        throw new Error("Send a prescription to the pharmacist before completing the visit.");
      }
      const medTotal = rx.reduce(
        (sum, p) => sum + p.items.reduce((s, i) => s + (i.medication?.price ?? 0) * i.quantity, 0),
        0,
      );
      const total = Number(doctor.consultation_fee ?? 0) + medTotal;
      await createInvoice({
        appointment_id: appointment.id,
        patient_id: appointment.patient_id,
        total_amount: total,
      });
      await updateAppointmentStatus(appointment.id, "completed");
      await createNotification(appointment.patient_id, {
        type: "record",
        title: "Visit completed",
        body: `Your visit record was saved. Invoice total: ${formatCurrency(total)}.`,
      });
    },
    onSuccess: () => {
      toast.success("Visit completed and invoice created");
      queryClient.invalidateQueries({ queryKey: ["appointment"] });
      queryClient.invalidateQueries({ queryKey: ["patient-records"] });
      queryClient.invalidateQueries({ queryKey: ["my-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-today-queue"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-completed"] });
      navigate("/app/doctor/queue");
    },
    onError: (error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!appointment) throw new Error("Missing context");
      const reason = cancelReason.trim();
      if (!reason) throw new Error("Please provide a cancellation reason");
      await updateAppointmentStatus(appointment.id, "cancelled", reason);
      await createNotification(appointment.patient_id, {
        type: "appointment",
        title: "Appointment cancelled",
        body: `Your visit on ${appointment.appointment_date} was cancelled by the doctor. Reason: ${reason}`,
      });
    },
    onSuccess: () => {
      toast.success("Visit cancelled");
      queryClient.invalidateQueries({ queryKey: ["appointment"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-today-queue"] });
      queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
      navigate("/app/doctor/queue");
    },
    onError: (error) => toast.error(error.message),
  });

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (!appointment) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const patient = appointment.patient;
  const hasPrescription = prescriptions.length > 0;
  const alreadyCompleted = appointment.status === "completed";
  const canCancel = ["pending", "confirmed", "checked-in", "in-progress"].includes(
    appointment.status,
  );
  const currentRecord = records.find((r) => r.appointment_id === appointment.id);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/app/doctor/queue">
          <ArrowLeft className="h-4 w-4" /> Back to queue
        </Link>
      </Button>

      <PageHeader
        title={patient?.full_name ?? "Patient"}
        description={`${appointment.appointment_date} at ${formatTime(appointment.time_slot)}`}
      >
        <AppointmentStatusBadge status={appointment.status} />
      </PageHeader>

      {patient?.allergies && (
        <Alert variant="destructive">
          <Stethoscope className="h-4 w-4" />
          <AlertTitle>Known allergies</AlertTitle>
          <AlertDescription>{patient.allergies}</AlertDescription>
        </Alert>
      )}
      {allergies.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangleNote allergies={allergies} />
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Patient info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{patient?.full_name ?? "—"}</p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" /> {patient?.phone ?? "—"}
              </p>
              <p className="text-muted-foreground">{patient?.email ?? "—"}</p>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reason</span>
                <span>{appointment.reason ?? "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prescriptions for this visit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {prescriptions.length === 0 ? (
                <p className="text-muted-foreground">
                  No prescription sent yet. Use the prescription step below.
                </p>
              ) : (
                prescriptions.map((p) => (
                  <div key={p.id} className="rounded-md border p-2">
                    <Badge variant="secondary">{p.status}</Badge>
                    <ul className="mt-1 space-y-1 text-xs">
                      {p.items.map((item) => (
                        <li key={item.id}>
                          {item.medication?.name} × {item.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {alreadyCompleted ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Visit completed
                </CardTitle>
                <CardDescription>
                  This visit has been completed and the invoice created.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentRecord ? (
                  <dl className="space-y-2 text-sm">
                    {currentRecord.symptoms && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Symptoms</dt>
                        <dd>{currentRecord.symptoms}</dd>
                      </div>
                    )}
                    {currentRecord.diagnosis && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Diagnosis</dt>
                        <dd>{currentRecord.diagnosis}</dd>
                      </div>
                    )}
                    {currentRecord.treatment_plan && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Treatment plan</dt>
                        <dd>{currentRecord.treatment_plan}</dd>
                      </div>
                    )}
                    {currentRecord.notes && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Notes</dt>
                        <dd>{currentRecord.notes}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">No consultation record found.</p>
                )}
                {hasPrescription && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Prescriptions</h3>
                    <div className="space-y-2">
                      {prescriptions.map((p) => (
                        <div key={p.id} className="rounded-md border p-2 text-sm">
                          <Badge variant="secondary">{p.status}</Badge>
                          <ul className="mt-1 space-y-1 text-xs">
                            {p.items.map((item) => (
                              <li key={item.id}>
                                {item.medication?.name} × {item.quantity}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                {steps.map((s, i) => {
                  const active = step === s.value;
                  const done = i === 0 && step === "prescription";
                  return (
                    <div key={s.value} className="flex items-center gap-2">
                      {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <span
                        className={cn(
                          "rounded-full px-3 py-1",
                          active && "bg-primary text-primary-foreground",
                          done && !active && "bg-emerald-100 text-emerald-700",
                          !active && !done && "bg-muted text-muted-foreground",
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className={cn(step !== "soap" && "hidden")}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ClipboardList className="h-4 w-4" /> SOAP note
                    </CardTitle>
                    <CardDescription>
                      Fill in the consultation details, then continue to prescribe medication.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form className="space-y-4">
                        <FormField
                          control={form.control}
                          name="symptoms"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Symptoms (S)</FormLabel>
                              <FormControl>
                                <Textarea rows={2} maxLength={300} placeholder="Subjective symptoms reported by patient" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="diagnosis"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Diagnosis (A) *</FormLabel>
                              <FormControl>
                                <Input maxLength={100} placeholder="e.g. Acute bronchitis" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="treatment_plan"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Treatment plan (P)</FormLabel>
                              <FormControl>
                                <Textarea rows={2} maxLength={300} placeholder="Plan, follow-up, lifestyle advice..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Textarea rows={2} maxLength={300} placeholder="Any additional clinical notes" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="text-destructive"
                                disabled={!canCancel}
                              >
                                <XCircle className="h-4 w-4" /> Cancel visit
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel this visit?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will cancel the appointment with {patient?.full_name ?? "the patient"}
                                  . A cancellation reason is required.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <Textarea
                                placeholder="Reason for cancellation (required)"
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                rows={3}
                                maxLength={300}
                              />
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={cancelMutation.isPending}>
                                  Keep visit
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={!cancelReason.trim() || cancelMutation.isPending}
                                  onClick={() => cancelMutation.mutate()}
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                  {cancelMutation.isPending ? "Cancelling..." : "Cancel visit"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                            type="button"
                            disabled={!diagnosis?.trim()}
                            onClick={() => setStep("prescription")}
                          >
                            Continue to prescription <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>

              {step === "prescription" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Stethoscope className="h-4 w-4" /> Prescription
                    </CardTitle>
                    <CardDescription>
                      Send the prescription to the pharmacist. The visit will be marked completed
                      automatically once sent.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => setStep("soap")}
                    >
                      <ArrowLeft className="h-4 w-4" /> Back to record
                    </Button>
                    {doctor ? (
                      <PrescriptionForm
                        patientId={appointment.patient_id}
                        doctorId={doctor.id}
                        appointmentId={appointment.id}
                        onSuccess={() => {
                          queryClient.invalidateQueries({
                            queryKey: ["appointment-prescriptions", appointmentId],
                          });
                          finalizeMutation.mutate();
                        }}
                      />
                    ) : (
                      <p className="text-muted-foreground">Doctor profile not found.</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {records.filter((r) => r.appointment_id !== appointment.id).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Visit history</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {records
                    .filter((r) => r.appointment_id !== appointment.id)
                    .map((record) => (
                      <div key={record.id} className="rounded-lg border p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <Badge variant="secondary">
                            {record.doctor?.profile?.full_name ?? "Doctor"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(record.created_at)}
                          </span>
                        </div>
                        <dl className="space-y-1 text-sm">
                          {record.diagnosis && (
                            <div>
                              <dt className="text-xs text-muted-foreground">Diagnosis</dt>
                              <dd>{record.diagnosis}</dd>
                            </div>
                          )}
                          {record.treatment_plan && (
                            <div>
                              <dt className="text-xs text-muted-foreground">Plan</dt>
                              <dd>{record.treatment_plan}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertTriangleNote({ allergies }: { allergies: { medication?: { name: string } | null; allergen: string | null; severity: string }[] }) {
  return (
    <>
      <Stethoscope className="h-4 w-4" />
      <AlertTitle>Registered medication allergies</AlertTitle>
      <AlertDescription>
        {allergies.map((a, i) => (
          <span key={i}>
            {a.medication?.name ?? a.allergen ?? "Unknown"} ({a.severity})
            {i < allergies.length - 1 ? ", " : ""}
          </span>
        ))}
      </AlertDescription>
    </>
  );
}
