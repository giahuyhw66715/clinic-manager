import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination, usePagination } from "@/components/shared/Pagination";
import { AppointmentStatusBadge } from "@/components/shared/StatusBadge";
import {
  getDoctorByUserId,
  getDoctorCompletedAppointments,
  getDoctorNoShowCancelled,
  getTodayDoctorAppointments,
  updateAppointmentStatus,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatTime } from "@/lib/utils";
import { Link } from "react-router-dom";

export function DoctorQueuePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: doctor } = useQuery({
    queryKey: ["my-doctor", user?.id],
    queryFn: () => getDoctorByUserId(user!.id),
    enabled: !!user,
  });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["doctor-today-queue", doctor?.id],
    queryFn: () => getTodayDoctorAppointments(doctor!.id),
    enabled: !!doctor,
  });

  const { data: inactiveAppointments = [], isLoading: inactiveLoading } = useQuery({
    queryKey: ["doctor-inactive", doctor?.id],
    queryFn: () => getDoctorNoShowCancelled(doctor!.id),
    enabled: !!doctor,
  });

  const { data: completedAppointments = [], isLoading: completedLoading } = useQuery({
    queryKey: ["doctor-completed", doctor?.id],
    queryFn: () => getDoctorCompletedAppointments(doctor!.id),
    enabled: !!doctor,
  });

  const queuePagination = usePagination(appointments);
  const completedPagination = usePagination(completedAppointments);
  const inactivePagination = usePagination(inactiveAppointments);

  useEffect(() => {
    if (!doctor) return;
    const channel = supabase
      .channel("doctor-queue-" + doctor.id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `doctor_id=eq.${doctor.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["doctor-today-queue"] });
          queryClient.invalidateQueries({ queryKey: ["doctor-inactive"] });
          queryClient.invalidateQueries({ queryKey: ["doctor-completed"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctor, queryClient]);

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "in-progress" | "no-show" }) => {
      await updateAppointmentStatus(id, status);
    },
    onSuccess: () => {
      toast.success("Appointment updated");
      queryClient.invalidateQueries({ queryKey: ["doctor-today-queue"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-inactive"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-completed"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description={format(new Date(), "EEEE, MMMM d, yyyy")}
      />

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Today's Queue</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="inactive">No-show &amp; Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          {isLoading ? (
            <CardGridSkeleton />
          ) : appointments.length === 0 ? (
            <EmptyState
              title="No appointments today"
              description="New appointments will appear here in real time."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {queuePagination.items.map((appointment) => (
                <Card key={appointment.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 min-w-[3.5rem] shrink-0 items-center justify-center rounded-full bg-primary/10 px-2 text-sm font-semibold text-primary">
                          {formatTime(appointment.time_slot)}
                        </span>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">
                            {appointment.patient?.full_name ?? "Patient"}
                          </CardTitle>
                          <CardDescription>{appointment.patient?.phone ?? "—"}</CardDescription>
                        </div>
                      </div>
                      <AppointmentStatusBadge status={appointment.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                    {appointment.patient?.allergies && (
                      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Allergies: {appointment.patient.allergies}
                      </p>
                    )}
                    {appointment.reason && (
                      <p className="line-clamp-3 text-muted-foreground">{appointment.reason}</p>
                    )}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex flex-wrap gap-2">
                        {(appointment.status === "confirmed" ||
                          appointment.status === "checked-in") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              statusMutation.mutate({ id: appointment.id, status: "in-progress" })
                            }
                          >
                            Start visit
                          </Button>
                        )}
                        {(appointment.status === "pending" ||
                          appointment.status === "confirmed" ||
                          appointment.status === "checked-in") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() =>
                              statusMutation.mutate({ id: appointment.id, status: "no-show" })
                            }
                          >
                            No-show
                          </Button>
                        )}
                      </div>
                      {appointment.status !== "no-show" && appointment.status !== "cancelled" && (
                        <Button size="sm" asChild>
                          <Link to={`/app/doctor/appointments/${appointment.id}`}>
                            Open <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {appointments.length > 0 && (
            <Pagination
              page={queuePagination.page}
              pageCount={queuePagination.pageCount}
              total={queuePagination.total}
              onChange={queuePagination.setPage}
            />
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completedLoading ? (
            <CardGridSkeleton />
          ) : completedAppointments.length === 0 ? (
            <EmptyState
              title="No completed visits"
              description="Visits you have completed will appear here."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {completedPagination.items.map((appointment) => (
                <Card key={appointment.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 min-w-[3.5rem] shrink-0 items-center justify-center rounded-full bg-primary/10 px-2 text-sm font-semibold text-primary">
                          {formatTime(appointment.time_slot)}
                        </span>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">
                            {appointment.patient?.full_name ?? "Patient"}
                          </CardTitle>
                          <CardDescription>
                            {format(
                              parseISO(appointment.appointment_date + "T00:00:00"),
                              "MMM d, yyyy",
                            )}
                            {" · "}
                            {appointment.patient?.phone ?? "—"}
                          </CardDescription>
                        </div>
                      </div>
                      <AppointmentStatusBadge status={appointment.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                    <div className="mt-auto flex items-center justify-end pt-2">
                      <Button size="sm" asChild>
                        <Link to={`/app/doctor/appointments/${appointment.id}`}>
                          View record <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {completedAppointments.length > 0 && (
            <Pagination
              page={completedPagination.page}
              pageCount={completedPagination.pageCount}
              total={completedPagination.total}
              onChange={completedPagination.setPage}
            />
          )}
        </TabsContent>

        <TabsContent value="inactive">
          {inactiveLoading ? (
            <CardGridSkeleton />
          ) : inactiveAppointments.length === 0 ? (
            <EmptyState
              title="No no-show or cancelled visits"
              description="No-show and cancelled appointments from the last 30 days will appear here."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {inactivePagination.items.map((appointment) => (
                <Card key={appointment.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 min-w-[3.5rem] shrink-0 items-center justify-center rounded-full bg-primary/10 px-2 text-sm font-semibold text-primary">
                          {formatTime(appointment.time_slot)}
                        </span>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">
                            {appointment.patient?.full_name ?? "Patient"}
                          </CardTitle>
                          <CardDescription>
                            {format(
                              parseISO(appointment.appointment_date + "T00:00:00"),
                              "MMM d, yyyy",
                            )}
                            {" · "}
                            {appointment.patient?.phone ?? "—"}
                          </CardDescription>
                        </div>
                      </div>
                      <AppointmentStatusBadge status={appointment.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                    {appointment.cancel_reason && (
                      <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                        {appointment.cancel_reason}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {inactiveAppointments.length > 0 && (
            <Pagination
              page={inactivePagination.page}
              pageCount={inactivePagination.pageCount}
              total={inactivePagination.total}
              onChange={inactivePagination.setPage}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}