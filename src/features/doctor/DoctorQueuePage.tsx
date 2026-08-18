import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination, usePagination } from "@/components/shared/Pagination";
import { ExpandableText } from "@/components/shared/ExpandableText";
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
import { Link, useNavigate } from "react-router-dom";

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

  const navigate = useNavigate();

  const startExamMutation = useMutation({
    mutationFn: async (id: string) => {
      await updateAppointmentStatus(id, "in-progress");
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["doctor-today-queue"] });
      navigate(`/app/doctor/appointments/${id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lịch hẹn"
        description={format(new Date(), "EEEE, d 'tháng' M, yyyy", { locale: vi })}
      />

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Hàng đợi hôm nay</TabsTrigger>
          <TabsTrigger value="completed">Hoàn tất</TabsTrigger>
          <TabsTrigger value="inactive">Vắng mặt &amp; Đã hủy</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          {isLoading ? (
            <CardGridSkeleton />
          ) : appointments.length === 0 ? (
            <EmptyState
              title="Hôm nay không có lịch hẹn"
              description="Lịch hẹn mới sẽ hiển thị tại đây theo thời gian thực."
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
                            {appointment.patient?.full_name ?? "Bệnh nhân"}
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
                        Dị ứng: {appointment.patient.allergies}
                      </p>
                    )}
                    <ExpandableText
                      text={appointment.reason}
                      emptyText="Không có mô tả"
                      className="text-muted-foreground"
                    />
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(), "dd/MM/yyyy")}
                      </span>
                      <div className="flex items-center justify-end gap-2">
                        {appointment.status === "checked-in" ? (
                          <Button
                            size="sm"
                            disabled={startExamMutation.isPending && startExamMutation.variables === appointment.id}
                            onClick={() => startExamMutation.mutate(appointment.id)}
                          >
                            Bắt đầu khám
                          </Button>
                        ) : (
                          appointment.status !== "no-show" &&
                            appointment.status !== "cancelled" && (
                              <Button size="sm" asChild>
                                <Link to={`/app/doctor/appointments/${appointment.id}`}>
                                  Mở <ArrowRight className="h-4 w-4" />
                                </Link>
                              </Button>
                            )
                        )}
                      </div>
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
              title="Chưa có buổi khám hoàn tất"
              description="Các buổi khám đã hoàn tất sẽ hiển thị tại đây."
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
                            {appointment.patient?.full_name ?? "Bệnh nhân"}
                          </CardTitle>
                          <CardDescription>{appointment.patient?.phone ?? "—"}</CardDescription>
                        </div>
                      </div>
                      <AppointmentStatusBadge status={appointment.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="text-xs text-muted-foreground">
                        {format(
                          parseISO(appointment.appointment_date + "T00:00:00"),
                          "dd/MM/yyyy",
                        )}
                      </span>
                      <Button size="sm" asChild>
                        <Link to={`/app/doctor/appointments/${appointment.id}`}>
                          Xem hồ sơ <ArrowRight className="h-4 w-4" />
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
              title="Không có buổi khám vắng mặt hay đã hủy"
              description="Các lịch hẹn vắng mặt hoặc đã hủy trong 30 ngày qua sẽ hiển thị tại đây."
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
                            {appointment.patient?.full_name ?? "Bệnh nhân"}
                          </CardTitle>
                          <CardDescription>
                            {format(
                              parseISO(appointment.appointment_date + "T00:00:00"),
                              "dd/MM/yyyy",
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
                    <ExpandableText
                      text={appointment.cancel_reason}
                      emptyText="Không có lý do hủy"
                      className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground"
                    />
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="text-xs text-muted-foreground">
                        {format(
                          parseISO(appointment.appointment_date + "T00:00:00"),
                          "dd/MM/yyyy",
                        )}
                      </span>
                      <Button size="sm" asChild>
                        <Link to={`/app/doctor/appointments/${appointment.id}`}>
                          Xem hồ sơ <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
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