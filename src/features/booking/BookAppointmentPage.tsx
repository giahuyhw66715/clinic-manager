import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Shuffle, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/PageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";
import {
  createAppointment,
  getBookedSlots,
  getDoctorOffDays,
  getDoctorSchedules,
  getDoctorsByDepartment,
  getDepartments,
  getUpcomingMyAppointments,
} from "@/lib/api";
import { createNotification } from "@/hooks/useNotifications";
import { generateAllSlotsForDate, generateSlotsForDate } from "@/lib/availability";
import { cn, formatCurrency, formatTime, initials, toDateKey } from "@/lib/utils";

type Step = "department" | "doctor" | "datetime";

export function BookAppointmentPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("department");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [doctorId, setDoctorId] = useState<string>("");
  const [autoAssign, setAutoAssign] = useState(true);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [timeSlot, setTimeSlot] = useState<string>("");
  const [reason, setReason] = useState("");

  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: getDepartments });
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors-by-department", departmentId],
    queryFn: () => getDoctorsByDepartment(departmentId),
    enabled: !!departmentId,
  });
  const { data: schedules = [] } = useQuery({
    queryKey: ["doctor-schedules", doctorId],
    queryFn: () => getDoctorSchedules(doctorId),
    enabled: !!doctorId,
  });
  const { data: offDays = [] } = useQuery({
    queryKey: ["doctor-off-days", doctorId],
    queryFn: () => getDoctorOffDays(doctorId),
    enabled: !!doctorId,
  });
  const { data: bookedSlots = [] } = useQuery({
    queryKey: ["booked-slots", doctorId, date ? toDateKey(date) : ""],
    queryFn: () => getBookedSlots(doctorId, toDateKey(date!)),
    enabled: !!doctorId && !!date,
  });
  const { data: autoAvailability = [] } = useQuery({
    queryKey: ["auto-availability", departmentId, date ? toDateKey(date) : ""],
    queryFn: async () => {
      return Promise.all(
        doctors.map(async (d) => {
          const [doctorSchedules, doctorOffDays] = await Promise.all([
            getDoctorSchedules(d.id),
            getDoctorOffDays(d.id),
          ]);
          const slots = date ? await getBookedSlots(d.id, toDateKey(date)) : [];
          return { doctorId: d.id, schedules: doctorSchedules, offDays: doctorOffDays, bookedSlots: slots };
        }),
      );
    },
    enabled: autoAssign && doctors.length > 0,
  });
  const { data: upcomingAppointments = [] } = useQuery({
    queryKey: ["upcoming-my-appointments", profile?.id],
    queryFn: () => getUpcomingMyAppointments(profile!.id),
    enabled: !!profile,
  });

  const selectedDoctor = doctors.find((d) => d.id === doctorId);

  const allSlots = useMemo(() => {
    if (!date) return [];
    if (autoAssign) {
      const set = new Set<string>();
      for (const r of autoAvailability) {
        for (const s of generateAllSlotsForDate(r.schedules, r.offDays, date)) set.add(s);
      }
      return [...set].sort();
    }
    return generateAllSlotsForDate(schedules, offDays, date);
  }, [date, autoAssign, autoAvailability, schedules, offDays]);

  const autoFreeSlots = useMemo(() => {
    if (!date || autoAvailability.length === 0) return [];
    const set = new Set<string>();
    for (const r of autoAvailability) {
      for (const s of generateSlotsForDate(r.schedules, r.offDays, r.bookedSlots, date)) set.add(s);
    }
    return [...set].sort();
  }, [autoAvailability, date]);

  const freeSlots = useMemo(
    () =>
      autoAssign
        ? autoFreeSlots
        : date
          ? generateSlotsForDate(schedules, offDays, bookedSlots, date)
          : [],
    [autoAssign, autoFreeSlots, date, schedules, offDays, bookedSlots],
  );

  const isToday = date != null && differenceInCalendarDays(date, new Date()) === 0;

  const isPastSlot = (slot: string) => {
    if (!date) return false;
    const [h, m] = slot.split(":").map(Number);
    const slotDate = new Date(date);
    slotDate.setHours(h, m, 0, 0);
    return slotDate.getTime() < Date.now();
  };

  const selectableSlots = useMemo(
    () => freeSlots.filter((s) => !(isToday && isPastSlot(s))),
    [freeSlots, isToday],
  );

  const MIN_GAP_MINUTES = 60;

  const conflictingSlots = useMemo(() => {
    const active = upcomingAppointments.filter(
      (a) => a.status !== "cancelled" && a.status !== "no-show",
    );
    if (!date || active.length === 0) return new Set<string>();
    const set = new Set<string>();
    for (const slot of allSlots) {
      const [h, m] = slot.split(":").map(Number);
      const slotMs = new Date(date).setHours(h, m, 0, 0);
      const conflicting = active.some((a) => {
        const [ah, am] = a.time_slot.split(":").map(Number);
        const apptMs = new Date(a.appointment_date + "T00:00:00").setHours(ah, am, 0, 0);
        return Math.abs(apptMs - slotMs) < MIN_GAP_MINUTES * 60 * 1000;
      });
      if (conflicting) set.add(slot);
    }
    return set;
  }, [allSlots, upcomingAppointments, date]);

  const getConflictAppointment = (slot: string) => {
    if (!date) return undefined;
    const [h, m] = slot.split(":").map(Number);
    const slotMs = new Date(date).setHours(h, m, 0, 0);
    return upcomingAppointments.find((a) => {
      if (a.status === "cancelled" || a.status === "no-show") return false;
      const [ah, am] = a.time_slot.split(":").map(Number);
      const apptMs = new Date(a.appointment_date + "T00:00:00").setHours(ah, am, 0, 0);
      return Math.abs(apptMs - slotMs) < MIN_GAP_MINUTES * 60 * 1000;
    });
  };

  const isSlotBooked = (slot: string) => {
    if (!date) return false;
    if (autoAssign) {
      return !autoAvailability.some((r) =>
        generateSlotsForDate(r.schedules, r.offDays, r.bookedSlots, date).includes(slot),
      );
    }
    return bookedSlots.includes(slot);
  };

  const isDateDisabled = (d: Date) => {
    if (differenceInCalendarDays(d, new Date()) < 0) return true;
    if (differenceInCalendarDays(d, new Date()) > 45) return true;
    if (autoAssign) {
      return !autoAvailability.some(
        (r) => generateSlotsForDate(r.schedules, r.offDays, [], d).length > 0,
      );
    }
    return generateAllSlotsForDate(schedules, offDays, d).length === 0;
  };

  function pickDoctor(slot: string): string | undefined {
    if (!date) return undefined;
    const candidates = autoAvailability.filter((r) =>
      generateSlotsForDate(r.schedules, r.offDays, r.bookedSlots, date).includes(slot),
    );
    if (candidates.length === 0) return undefined;
    candidates.sort((a, b) => a.bookedSlots.length - b.bookedSlots.length);
    return candidates[0].doctorId;
  }

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Chưa đăng nhập");
      const [sh, sm] = timeSlot.split(":").map(Number);
      const slotMs = new Date(date!).setHours(sh, sm, 0, 0);
      const blockedByConflict = upcomingAppointments.some((a) => {
        if (a.status === "cancelled" || a.status === "no-show") return false;
        const [ah, am] = a.time_slot.split(":").map(Number);
        const apptMs = new Date(a.appointment_date + "T00:00:00").setHours(ah, am, 0, 0);
        return Math.abs(apptMs - slotMs) < MIN_GAP_MINUTES * 60 * 1000;
      });
      if (blockedByConflict) {
        throw new Error(
          "Khung giờ này cách lịch hẹn hiện có của bạn chưa đủ 1 tiếng. Vui lòng chọn giờ khác.",
        );
      }
      let appointmentDoctorId = doctorId;
      if (autoAssign || !appointmentDoctorId) {
        appointmentDoctorId = pickDoctor(timeSlot) ?? "";
      }
      if (!appointmentDoctorId) {
        throw new Error("Không có bác sĩ trống vào giờ này. Vui lòng chọn thời gian khác.");
      }
      await createAppointment({
        patient_id: profile.id,
        doctor_id: appointmentDoctorId,
        appointment_date: toDateKey(date!),
        time_slot: timeSlot,
        reason: reason || undefined,
      });
      await createNotification(profile.id, {
        type: "appointment",
        title: "Đặt lịch thành công",
        body: `Lịch hẹn của bạn vào ${formatDate(date!)} lúc ${formatTime(timeSlot)} đang chờ xác nhận.`,
      });
    },
    onSuccess: () => {
      toast.success("Đặt lịch khám thành công");
      queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
      navigate("/app/appointments", { replace: true });
    },
    onError: (error) => {
      if (error.message.includes("duplicate key value violates unique constraint")) {
        toast.error("Khung giờ này vừa được đặt. Vui lòng chọn giờ khác.");
        queryClient.invalidateQueries({ queryKey: ["booked-slots"] });
        return;
      }
      toast.error(error.message);
    },
  });

  const canGoNext = step === "department" ? !!departmentId : step === "doctor" ? true : !!date;

  function handleNext() {
    if (step === "department" && departmentId) setStep("doctor");
    else if (step === "doctor") setStep("datetime");
    else if (step === "datetime" && date) setStep("datetime");
  }

  function handleBack() {
    if (step === "doctor") setStep("department");
    else if (step === "datetime") setStep("doctor");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đặt lịch khám"
        description="Chọn khoa khám, bác sĩ và giờ hẹn"
      />

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        {["Khoa khám", "Bác sĩ", "Ngày & Giờ"].map((label, i) => {
          const value = (["department", "doctor", "datetime"] as Step[])[i];
          const active = step === value;
          const done = (i === 0 && !!departmentId) || (i === 1 && !!doctorId) || (i === 2 && !!date);
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <span
                className={cn(
                  "rounded-full px-3 py-1",
                  active && "bg-primary text-primary-foreground",
                  done && !active && "bg-emerald-100 text-emerald-700",
                  !active && !done && "bg-muted text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>
              {step === "department" && "Chọn khoa khám"}
              {step === "doctor" && "Chọn bác sĩ"}
              {step === "datetime" && "Chọn ngày và giờ"}
            </CardTitle>
            <CardDescription className="sr-only">Bước đặt lịch</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === "department" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {departments.map((department) => (
                  <button
                    key={department.id}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors hover:border-primary",
                      departmentId === department.id && "border-primary bg-primary/5",
                    )}
                    onClick={() => {
                      setDepartmentId(department.id);
                      setDoctorId("");
                    }}
                  >
                    <p className="font-medium">{department.name}</p>
                    {department.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{department.description}</p>
                    )}
                  </button>
                ))}
                {departments.length === 0 && (
                  <p className="text-sm text-muted-foreground">Chưa có khoa khám nào.</p>
                )}
              </div>
            )}

            {step === "doctor" && (
              <div className="grid grid-cols-1 gap-3">
                <button
                  className={cn(
                    "flex items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:border-primary",
                    autoAssign && "border-primary bg-primary/5",
                  )}
                  onClick={() => {
                    setAutoAssign(true);
                    setDoctorId("");
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Shuffle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Tự động chọn bác sĩ</p>
                    <p className="text-sm text-muted-foreground">
                      Hệ thống sẽ chọn bác sĩ rảnh nhất phù hợp với giờ bạn chọn khi đặt lịch.
                    </p>
                  </div>
                </button>
                {doctors.map((doctor) => (
                  <button
                    key={doctor.id}
                    className={cn(
                      "flex items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:border-primary",
                      !autoAssign && doctorId === doctor.id && "border-primary bg-primary/5",
                    )}
                    onClick={() => {
                      setAutoAssign(false);
                      setDoctorId(doctor.id);
                    }}
                  >
                    <Avatar>
                      <AvatarFallback>{initials(doctor.profile?.full_name ?? "Bác sĩ")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{doctor.profile?.full_name ?? "Không rõ"}</p>
                      <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(doctor.consultation_fee)}
                    </span>
                  </button>
                ))}
                {doctors.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Khoa này chưa có bác sĩ. Vui lòng quay lại chọn khoa khác.
                  </p>
                )}
              </div>
            )}

            {step === "datetime" && (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Label className="mb-2 block">Ngày *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {date ? formatDate(date) : "Chọn ngày"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={date} onSelect={setDate} disabled={isDateDisabled} />
                    </PopoverContent>
                  </Popover>
                  {!autoAssign && doctorId && schedules.length === 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      Bác sĩ này chưa thiết lập lịch làm việc. Vui lòng liên hệ quản trị viên.
                    </p>
                  )}
                  {date && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {allSlots.length === 0
                        ? "Bác sĩ không làm việc vào ngày này."
                        : selectableSlots.length === 0
                          ? "Không còn suất trống vào ngày này."
                          : `${selectableSlots.length} suất trống`}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="mb-2 block">Giờ hẹn *</Label>
                  {date && allSlots.length > 0 ? (
                    <ScrollArea className="h-64 rounded-md border pr-2">
                      <div className="grid grid-cols-3 gap-2 p-2">
                        {allSlots.map((slot) => {
                          const booked = isSlotBooked(slot);
                          const past = isToday && isPastSlot(slot);
                          const conflict = conflictingSlots.has(slot);
                          const disabled = booked || past;
                          return (
                            <button
                              key={slot}
                              disabled={disabled}
                              className={cn(
                                "rounded-md border p-2 text-sm transition-colors hover:border-primary",
                                timeSlot === slot && "border-primary bg-primary text-primary-foreground",
                                disabled && "cursor-not-allowed opacity-40 hover:border-border",
                              )}
                              onClick={() => {
                                if (conflict) {
                                  const appt = getConflictAppointment(slot);
                                  toast.error(
                                      `Bạn đã có lịch hẹn với bác sĩ ${appt?.doctor?.profile?.full_name ?? "khác"} lúc ${formatTime(appt?.time_slot ?? slot)}. Vui lòng chọn thời gian cách thời gian đã hẹn ít nhất 1 tiếng.`,
                                  );
                                  return;
                                }
                                setTimeSlot(slot);
                              }}
                            >
                              {formatTime(slot)}
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                      {date ? "Bác sĩ không làm việc vào ngày này." : "Vui lòng chọn ngày trước."}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <Button variant="outline" onClick={handleBack} disabled={step === "department"}>
                <ChevronLeft className="h-4 w-4" /> Quay lại
              </Button>
              {step !== "datetime" ? (
                <Button onClick={handleNext} disabled={!canGoNext}>
                  Tiếp tục <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => bookMutation.mutate()}
                  disabled={!timeSlot || conflictingSlots.has(timeSlot) || bookMutation.isPending}
                >
                  {bookMutation.isPending ? "Đang đặt lịch..." : "Đặt lịch khám"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tóm tắt lịch hẹn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">
                    {selectedDoctor?.profile?.full_name ??
                      (autoAssign ? "Tự động chọn" : "Chưa chọn bác sĩ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedDoctor?.specialty ??
                      (autoAssign ? "Sẽ chọn khi bạn đặt lịch" : "")}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="space-y-1">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Ngày</span>
                  <span>{date ? formatDate(date) : "—"}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Giờ</span>
                  <span>{timeSlot ? formatTime(timeSlot) : "—"}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Phí khám</span>
                  <span>{formatCurrency(selectedDoctor?.consultation_fee ?? 0)}</span>
                </p>
              </div>
              <Separator />
              <Label className="block">Mô tả triệu chứng (tùy chọn)</Label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Mô tả triệu chứng của bạn..."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}