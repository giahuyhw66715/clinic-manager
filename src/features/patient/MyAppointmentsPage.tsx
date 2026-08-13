import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, differenceInHours, format, parseISO } from "date-fns";
import { toast } from "sonner";
import { CalendarDays, CalendarPlus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Pagination, usePagination } from "@/components/shared/Pagination";
import { AppointmentStatusBadge } from "@/components/shared/StatusBadge";
import { getMyAppointments, updateAppointmentSchedule, updateAppointmentStatus, getDoctorSchedules, getDoctorOffDays, getBookedSlots } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { generateSlotsForDate } from "@/lib/availability";
import { cn, formatTime, toDateKey } from "@/lib/utils";

export const CANCEL_WINDOW_HOURS = 6;

export function MyAppointmentsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [rescheduling, setRescheduling] = useState<{ id: string; doctor_id: string } | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [timeSlot, setTimeSlot] = useState<string>("");

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["my-appointments", profile?.id],
    queryFn: () => getMyAppointments(profile!.id),
    enabled: !!profile,
  });

  const paginated = usePagination(appointments);

  const { data: schedules = [] } = useQuery({
    queryKey: ["doctor-schedules", rescheduling?.doctor_id],
    queryFn: () => getDoctorSchedules(rescheduling!.doctor_id),
    enabled: !!rescheduling,
  });
  const { data: offDays = [] } = useQuery({
    queryKey: ["doctor-off-days", rescheduling?.doctor_id],
    queryFn: () => getDoctorOffDays(rescheduling!.doctor_id),
    enabled: !!rescheduling,
  });
  const { data: bookedSlots = [] } = useQuery({
    queryKey: ["booked-slots", rescheduling?.doctor_id, date ? toDateKey(date) : ""],
    queryFn: () => getBookedSlots(rescheduling!.doctor_id, toDateKey(date!)),
    enabled: !!rescheduling && !!date,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
  }

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await updateAppointmentStatus(id, "cancelled");
    },
    onSuccess: () => {
      toast.success("Appointment cancelled");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!rescheduling || !date) return;
      await updateAppointmentSchedule(rescheduling.id, toDateKey(date!), timeSlot);
    },
    onSuccess: async () => {
      toast.success("Appointment rescheduled");
      setRescheduling(null);
      setDate(undefined);
      setTimeSlot("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canCancel = (appointmentDate: string, timeSlot: string, status: string) => {
    if (!["pending", "confirmed"].includes(status)) return false;
    const appointmentTime = parseISO(`${appointmentDate}T${timeSlot}`);
    return differenceInHours(appointmentTime, new Date()) >= CANCEL_WINDOW_HOURS;
  };

  const freeSlots = date && rescheduling
    ? generateSlotsForDate(schedules, offDays, bookedSlots, date)
    : [];

  const rescheduleIsToday = date != null && differenceInCalendarDays(date, new Date()) === 0;

  const isPastSlot = (slot: string) => {
    if (!date) return false;
    const [h, m] = slot.split(":").map(Number);
    const slotDate = new Date(date);
    slotDate.setHours(h, m, 0, 0);
    return slotDate.getTime() < Date.now();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Appointments"
        description="Book, cancel, or reschedule your visits"
      >
        <Button asChild>
          <a href="/app/book">
            <CalendarPlus className="h-4 w-4" /> New appointment
          </a>
        </Button>
      </PageHeader>

      {isLoading ? (
        <CardGridSkeleton className="md:grid-cols-1" />
      ) : appointments.length === 0 ? (
        <EmptyState
          title="No appointments yet"
          description="Book your first appointment with one of our doctors."
          action={
            <Button asChild>
              <a href="/app/book">
                <Plus className="h-4 w-4" /> Book now
              </a>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {paginated.items.map((appointment) => (
            <Card key={appointment.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {appointment.doctor?.profile?.full_name ?? "Doctor"}
                    </CardTitle>
                    <CardDescription>
                      {appointment.doctor?.specialty ?? ""}
                    </CardDescription>
                  </div>
                  <AppointmentStatusBadge status={appointment.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  {format(parseISO(appointment.appointment_date + "T00:00:00"), "MMM d, yyyy")} at{" "}
                  {formatTime(appointment.time_slot)}
                </div>
                {appointment.reason && (
                  <p className="text-muted-foreground">{appointment.reason}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {(appointment.status === "pending" || appointment.status === "confirmed") && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canCancel(appointment.appointment_date, appointment.time_slot, appointment.status)}
                        onClick={() =>
                          setRescheduling({ id: appointment.id, doctor_id: appointment.doctor_id })
                        }
                      >
                        Reschedule
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
disabled={!canCancel(appointment.appointment_date, appointment.time_slot, appointment.status)}
                          >
                            Cancel
                          </Button>
                        }
                        title="Cancel appointment?"
                        description={`Cancel the appointment on ${appointment.appointment_date}. You can cancel up to ${CANCEL_WINDOW_HOURS} hours before.`}
                        confirmLabel="Yes, cancel it"
                        onConfirm={() => cancelMutation.mutate(appointment.id)}
                      />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {appointments.length > 0 && (
        <Pagination
          page={paginated.page}
          pageCount={paginated.pageCount}
          total={paginated.total}
          onChange={paginated.setPage}
        />
      )}

      <Dialog open={!!rescheduling} onOpenChange={(open) => !open && setRescheduling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule appointment</DialogTitle>
            <DialogDescription>
              Pick a new date and time. The appointment will be re-sent for confirmation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-2 block">New date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {date ? date.toDateString() : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      setDate(d);
                      setTimeSlot("");
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="mb-2 block">New time *</Label>
              {date ? (
                freeSlots.length === 0 ? (
                  <div className="flex h-9 items-center rounded-md border border-dashed text-xs text-muted-foreground">
                    No free slots
                  </div>
                ) : (
                  <ScrollArea className="h-48 rounded-md border pr-2">
                    <div className="grid grid-cols-3 gap-2 p-2">
                      {freeSlots.map((slot) => {
                        const past = rescheduleIsToday && isPastSlot(slot);
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
                )
              ) : (
                <div className="flex h-9 items-center rounded-md border border-dashed text-xs text-muted-foreground">
                  Pick a date first
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => rescheduleMutation.mutate()}
              disabled={!date || !timeSlot || rescheduleMutation.isPending}
            >
              {rescheduleMutation.isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}