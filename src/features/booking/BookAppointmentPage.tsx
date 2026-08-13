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
import {
  createAppointment,
  getBookedSlots,
  getDoctorOffDays,
  getDoctorSchedules,
  getDoctorsByDepartment,
  getDepartments,
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
      if (!profile) throw new Error("Not signed in");
      let appointmentDoctorId = doctorId;
      if (autoAssign || !appointmentDoctorId) {
        appointmentDoctorId = pickDoctor(timeSlot) ?? "";
      }
      if (!appointmentDoctorId) {
        throw new Error("No doctor is free for this slot. Please pick another time.");
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
        title: "Appointment booked",
        body: `Your appointment is pending confirmation on ${toDateKey(date!)} at ${formatTime(timeSlot)}.`,
      });
    },
    onSuccess: () => {
      toast.success("Appointment booked successfully");
      queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
      navigate("/app/appointments", { replace: true });
    },
    onError: (error) => toast.error(error.message),
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
        title="Book an Appointment"
        description="Choose a department, doctor, and time slot"
      />

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        {["Department", "Doctor", "Date & Time"].map((label, i) => {
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
              {step === "department" && "Select a department"}
              {step === "doctor" && "Select a doctor"}
              {step === "datetime" && "Select date and time"}
            </CardTitle>
            <CardDescription className="sr-only">Booking step</CardDescription>
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
                  <p className="text-sm text-muted-foreground">No departments available yet.</p>
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
                    <p className="font-medium">Auto-assign a doctor</p>
                    <p className="text-sm text-muted-foreground">
                      We'll pick the least-busy doctor who is free for your slot when you book.
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
                      <AvatarFallback>{initials(doctor.profile?.full_name ?? "Doctor")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{doctor.profile?.full_name ?? "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(doctor.consultation_fee)}
                    </span>
                  </button>
                ))}
                {doctors.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No doctors in this department yet. Go back and pick another department.
                  </p>
                )}
              </div>
            )}

            {step === "datetime" && (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Label className="mb-2 block">Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {date ? date.toDateString() : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={date} onSelect={setDate} disabled={isDateDisabled} />
                    </PopoverContent>
                  </Popover>
                  {date && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {allSlots.length === 0
                        ? "The doctor is not available on this day."
                        : `${allSlots.length} slots available`}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="mb-2 block">Time slot *</Label>
                  {date && freeSlots.length > 0 ? (
                    <ScrollArea className="h-64 rounded-md border pr-2">
                      <div className="grid grid-cols-3 gap-2 p-2">
                        {freeSlots.map((slot) => {
                          const past = isToday && isPastSlot(slot);
                          return (
                            <button
                              key={slot}
                              disabled={past}
                              className={cn(
                                "rounded-md border p-2 text-sm transition-colors hover:border-primary",
                                timeSlot === slot && "border-primary bg-primary text-primary-foreground",
                                past && "cursor-not-allowed opacity-40 hover:border-border",
                              )}
                              onClick={() => setTimeSlot(slot)}
                            >
                              {formatTime(slot)}
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                      {date ? "No free slots on this date." : "Pick a date first."}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <Button variant="outline" onClick={handleBack} disabled={step === "department"}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              {step !== "datetime" ? (
                <Button onClick={handleNext} disabled={!canGoNext}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => bookMutation.mutate()}
                  disabled={!timeSlot || bookMutation.isPending}
                >
                  {bookMutation.isPending ? "Booking..." : "Book appointment"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Booking summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">
                    {selectedDoctor?.profile?.full_name ??
                      (autoAssign ? "Auto-assign" : "No doctor selected")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedDoctor?.specialty ??
                      (autoAssign ? "Picked when you book" : "")}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="space-y-1">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span>{date ? date.toDateString() : "—"}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span>{timeSlot ? formatTime(timeSlot) : "—"}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Consultation fee</span>
                  <span>{formatCurrency(selectedDoctor?.consultation_fee ?? 0)}</span>
                </p>
              </div>
              <Separator />
              <Label className="block">Reason for visit (optional)</Label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Describe your symptoms..."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}