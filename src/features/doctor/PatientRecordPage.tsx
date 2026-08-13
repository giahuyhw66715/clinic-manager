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
  symptoms: z.string().max(300, "Triệu chứng không được quá 300 ký tự").optional(),
  diagnosis: z.string().min(1, "Vui lòng nhập chẩn đoán").max(100, "Chẩn đoán không được quá 100 ký tự"),
  treatment_plan: z.string().max(300, "Kế hoạch điều trị không được quá 300 ký tự").optional(),
  notes: z.string().max(300, "Ghi chú không được quá 300 ký tự").optional(),
});

type SoapValues = z.infer<typeof soapSchema>;

const steps = [
  { label: "Hồ sơ khám", value: "soap" },
  { label: "Kê đơn & hoàn tất", value: "prescription" },
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
      throw new Error("Không thể lưu hồ sơ khám");
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!appointment || !doctor) throw new Error("Missing context");
      const values = form.getValues();
      await saveSoapMutation.mutateAsync(values);
      const rx = await getAppointmentPrescriptions(appointment.id);
      if (rx.length === 0) {
        throw new Error("Vui lòng gửi đơn thuốc cho dược sĩ trước khi hoàn tất buổi khám.");
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
        title: "Hoàn tất buổi khám",
        body: `Hồ sơ buổi khám đã được lưu. Tổng hóa đơn: ${formatCurrency(total)}.`,
      });
    },
    onSuccess: () => {
      toast.success("Đã hoàn tất buổi khám và tạo hóa đơn");
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
      if (!reason) throw new Error("Vui lòng nhập lý do hủy");
      await updateAppointmentStatus(appointment.id, "cancelled", reason);
      await createNotification(appointment.patient_id, {
        type: "appointment",
        title: "Đã hủy lịch hẹn",
        body: `Buổi khám ngày ${appointment.appointment_date} đã bị bác sĩ hủy. Lý do: ${reason}`,
      });
    },
    onSuccess: () => {
      toast.success("Đã hủy buổi khám");
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
    return <p className="text-muted-foreground">Đang tải...</p>;
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
          <ArrowLeft className="h-4 w-4" /> Quay lại hàng đợi
        </Link>
      </Button>

      <PageHeader
        title={patient?.full_name ?? "Bệnh nhân"}
        description={`${appointment.appointment_date} lúc ${formatTime(appointment.time_slot)}`}
      >
        <AppointmentStatusBadge status={appointment.status} />
      </PageHeader>

      {patient?.allergies && (
        <Alert variant="destructive">
          <Stethoscope className="h-4 w-4" />
          <AlertTitle>Dị ứng đã biết</AlertTitle>
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
              <CardTitle className="text-base">Thông tin bệnh nhân</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{patient?.full_name ?? "—"}</p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" /> {patient?.phone ?? "—"}
              </p>
              <p className="text-muted-foreground">{patient?.email ?? "—"}</p>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lý do</span>
                <span>{appointment.reason ?? "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Đơn thuốc của buổi khám này</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {prescriptions.length === 0 ? (
                <p className="text-muted-foreground">
                  Chưa có đơn thuốc nào. Vui lòng dùng bước kê đơn bên dưới.
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
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Hoàn tất buổi khám
                </CardTitle>
                <CardDescription>
                  Buổi khám đã hoàn tất và hóa đơn đã được tạo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentRecord ? (
                  <dl className="space-y-2 text-sm">
                    {currentRecord.symptoms && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Triệu chứng</dt>
                        <dd>{currentRecord.symptoms}</dd>
                      </div>
                    )}
                    {currentRecord.diagnosis && (
                      <div>
                              <dt className="text-xs text-muted-foreground">Chẩn đoán</dt>
                        <dd>{currentRecord.diagnosis}</dd>
                      </div>
                    )}
                    {currentRecord.treatment_plan && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Kế hoạch điều trị</dt>
                        <dd>{currentRecord.treatment_plan}</dd>
                      </div>
                    )}
                    {currentRecord.notes && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Ghi chú</dt>
                        <dd>{currentRecord.notes}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">Không tìm thấy hồ sơ khám.</p>
                )}
                {hasPrescription && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Đơn thuốc</h3>
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
                      <ClipboardList className="h-4 w-4" /> Ghi chú SOAP
                    </CardTitle>
                    <CardDescription>
                      Điền thông tin khám, sau đó tiếp tục kê đơn thuốc.
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
                              <FormLabel>Triệu chứng (S)</FormLabel>
                              <FormControl>
                                <Textarea rows={2} maxLength={300} placeholder="Triệu chứng chủ quan do bệnh nhân mô tả" {...field} />
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
                              <FormLabel>Chẩn đoán (A) *</FormLabel>
                              <FormControl>
                                <Input maxLength={100} placeholder="VD: Viêm phế quản cấp" {...field} />
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
                              <FormLabel>Kế hoạch điều trị (P)</FormLabel>
                              <FormControl>
                                <Textarea rows={2} maxLength={300} placeholder="Kế hoạch, tái khám, lời khuyên..." {...field} />
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
                              <FormLabel>Ghi chú</FormLabel>
                              <FormControl>
                                <Textarea rows={2} maxLength={300} placeholder="Ghi chú lâm sàng bổ sung" {...field} />
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
                                <XCircle className="h-4 w-4" /> Hủy buổi khám
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hủy buổi khám này?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Thao tác này sẽ hủy lịch hẹn với {patient?.full_name ?? "bệnh nhân"}
                                  . Vui lòng nhập lý do hủy.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <Textarea
                                placeholder="Lý do hủy (bắt buộc)"
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                rows={3}
                                maxLength={300}
                              />
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={cancelMutation.isPending}>
                                  Giữ buổi khám
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={!cancelReason.trim() || cancelMutation.isPending}
                                  onClick={() => cancelMutation.mutate()}
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                  {cancelMutation.isPending ? "Đang hủy..." : "Hủy buổi khám"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                            type="button"
                            disabled={!diagnosis?.trim()}
                            onClick={() => setStep("prescription")}
                          >
                            Tiếp tục kê đơn <ArrowRight className="h-4 w-4" />
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
                      <Stethoscope className="h-4 w-4" /> Đơn thuốc
                    </CardTitle>
                    <CardDescription>
                      Gửi đơn thuốc cho dược sĩ. Buổi khám sẽ tự động được đánh dấu hoàn tất sau khi gửi.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => setStep("soap")}
                    >
                      <ArrowLeft className="h-4 w-4" /> Quay lại hồ sơ
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
                      <p className="text-muted-foreground">Không tìm thấy hồ sơ bác sĩ.</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {records.filter((r) => r.appointment_id !== appointment.id).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lịch sử khám</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {records
                    .filter((r) => r.appointment_id !== appointment.id)
                    .map((record) => (
                      <div key={record.id} className="rounded-lg border p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <Badge variant="secondary">
                            {record.doctor?.profile?.full_name ?? "Bác sĩ"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(record.created_at)}
                          </span>
                        </div>
                        <dl className="space-y-1 text-sm">
                          {record.diagnosis && (
                            <div>
                        <dt className="text-xs text-muted-foreground">Chẩn đoán</dt>
                              <dd>{record.diagnosis}</dd>
                            </div>
                          )}
                          {record.treatment_plan && (
                            <div>
                              <dt className="text-xs text-muted-foreground">Kế hoạch</dt>
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
      <AlertTitle>Dị ứng thuốc đã ghi nhận</AlertTitle>
      <AlertDescription>
        {allergies.map((a, i) => (
          <span key={i}>
            {a.medication?.name ?? a.allergen ?? "Không rõ"} ({a.severity})
            {i < allergies.length - 1 ? ", " : ""}
          </span>
        ))}
      </AlertDescription>
    </>
  );
}
