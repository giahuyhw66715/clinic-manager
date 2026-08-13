import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, ClipboardList, Plus, Stethoscope } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PrescriptionForm } from "@/features/doctor/components/PrescriptionForm";
import {
  createMedicalRecord,
  getDoctorByUserId,
  getPatientAllergies,
  getPatientMedicalRecords,
  getPatientPrescriptions,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/utils";
import type { Profile } from "@/types";

const recordSchema = z.object({
  symptoms: z.string().max(300, "Symptoms must be under 300 characters").optional(),
  diagnosis: z.string().min(1, "Diagnosis is required").max(100, "Diagnosis must be under 100 characters"),
  treatment_plan: z.string().max(300, "Treatment plan must be under 300 characters").optional(),
  notes: z.string().max(300, "Notes must be under 300 characters").optional(),
});

type RecordValues = z.infer<typeof recordSchema>;

export function PatientHistoryPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: patientProfile } = useQuery({
    queryKey: ["patient-profile", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", patientId!)
        .maybeSingle();
      return (data ?? null) as Profile | null;
    },
    enabled: !!patientId,
  });

  const { data: doctor } = useQuery({
    queryKey: ["my-doctor", user?.id],
    queryFn: () => getDoctorByUserId(user!.id),
    enabled: !!user,
  });

  const { data: records = [] } = useQuery({
    queryKey: ["patient-records", patientId],
    queryFn: () => getPatientMedicalRecords(patientId!),
    enabled: !!patientId,
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ["patient-prescriptions", patientId],
    queryFn: () => getPatientPrescriptions(patientId!),
    enabled: !!patientId,
  });

  const { data: allergies = [] } = useQuery({
    queryKey: ["patient-allergies", patientId],
    queryFn: () => getPatientAllergies(patientId!),
    enabled: !!patientId,
  });

  const form = useForm<RecordValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: { symptoms: "", diagnosis: "", treatment_plan: "", notes: "" },
  });

  const saveRecordMutation = useMutation({
    mutationFn: async (values: RecordValues) => {
      if (!patientId || !doctor) throw new Error("Missing context");
      await createMedicalRecord({
        appointment_id: null,
        patient_id: patientId,
        doctor_id: doctor.id,
        symptoms: values.symptoms,
        diagnosis: values.diagnosis,
        treatment_plan: values.treatment_plan,
        notes: values.notes,
      });
    },
    onSuccess: () => {
      toast.success("Medical record saved");
      queryClient.invalidateQueries({ queryKey: ["patient-records"] });
      form.reset();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/app/doctor/patients">
          <ArrowLeft className="h-4 w-4" /> Back to patients
        </Link>
      </Button>

      <PageHeader
        title={patientProfile?.full_name ?? "Patient"}
        description={patientProfile?.phone ?? "Patient record"}
      />

      {patientProfile?.allergies && (
        <Alert variant="destructive">
          <Stethoscope className="h-4 w-4" />
          <AlertTitle>Known allergies</AlertTitle>
          <AlertDescription>{patientProfile.allergies}</AlertDescription>
        </Alert>
      )}
      {allergies.length > 0 && (
        <Alert variant="destructive">
          <Stethoscope className="h-4 w-4" />
          <AlertTitle>Registered medication allergies</AlertTitle>
          <AlertDescription>
            {allergies.map((a) => a.medication?.name ?? a.allergen).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">Medical records</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
          <TabsTrigger value="new">New consultation</TabsTrigger>
        </TabsList>

        <TabsContent value="records">
          {records.length === 0 ? (
            <EmptyState title="No medical records" description="No records for this patient yet." />
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <Card key={record.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        {record.diagnosis ?? "Consultation"}
                      </CardTitle>
                      <Badge variant="secondary">
                        {record.doctor?.profile?.full_name ?? "—"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(record.created_at)}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    {record.symptoms && <p>{record.symptoms}</p>}
                    {record.treatment_plan && (
                      <p className="text-muted-foreground">Plan: {record.treatment_plan}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="prescriptions">
          {prescriptions.length === 0 ? (
            <EmptyState title="No prescriptions" description="No prescriptions for this patient yet." />
          ) : (
            <div className="space-y-3">
              {prescriptions.map((prescription) => (
                <Card key={prescription.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {formatDateTime(prescription.created_at)}
                      </CardTitle>
                      <Badge variant="secondary">{prescription.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm">
                      {prescription.items.map((item) => (
                        <li key={item.id}>
                          {item.medication?.name} × {item.quantity}
                          {item.dosage ? ` · ${item.dosage}` : ""}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New SOAP record</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((values) => saveRecordMutation.mutate(values))}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="symptoms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Symptoms</FormLabel>
                          <FormControl>
                            <Textarea rows={2} maxLength={300} placeholder="Subjective symptoms" {...field} />
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
                          <FormLabel>Diagnosis *</FormLabel>
                          <FormControl>
                            <Input maxLength={100} placeholder="e.g. Hypertension" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="treatment_plan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Treatment plan</FormLabel>
<FormControl>
                            <Textarea rows={2} maxLength={300} placeholder="Plan, follow-up..." {...field} />
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
                            <Textarea rows={2} maxLength={300} placeholder="Additional notes" {...field} />
                          </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={saveRecordMutation.isPending}>
                    {saveRecordMutation.isPending ? "Saving..." : "Save record"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4" /> Issue prescription
              </CardTitle>
            </CardHeader>
            <CardContent>
              {doctor && patientId && (
                <PrescriptionForm
                  patientId={patientId}
                  doctorId={doctor.id}
                  appointmentId={null}
                  onSuccess={() =>
                    queryClient.invalidateQueries({ queryKey: ["patient-prescriptions"] })
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}