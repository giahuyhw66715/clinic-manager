import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { AppointmentStatusBadge } from "@/components/shared/StatusBadge";
import { getTodayAppointmentsForCheckIn, updateAppointmentStatus } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { formatTime } from "@/lib/utils";

export function CheckInPage() {
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["today-checkin"],
    queryFn: getTodayAppointmentsForCheckIn,
  });

  useEffect(() => {
    const channel = supabase
      .channel("checkin-appointments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["today-checkin"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const checkInMutation = useMutation({
    mutationFn: async (id: string) => {
      await updateAppointmentStatus(id, "checked-in");
    },
    onSuccess: () => {
      toast.success("Bệnh nhân đã check-in");
      queryClient.invalidateQueries({ queryKey: ["today-checkin"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const pending = appointments.filter((a) => a.status === "pending");
  const checkedIn = appointments.filter((a) => a.status === "checked-in" || a.status === "in-progress");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-in bệnh nhân"
        description="Xác nhận bệnh nhân đến khám trong ngày"
      />

      {isLoading ? (
        <CardGridSkeleton className="md:grid-cols-2 lg:grid-cols-3" />
      ) : (
        <>
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              Chờ check-in <Badge variant="secondary">{pending.length}</Badge>
            </h2>
            {pending.length === 0 ? (
              <EmptyState title="Không có bệnh nhân chờ check-in" description="Hôm nay không có lịch hẹn đang chờ." />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {pending.map((appointment) => (
                  <Card key={appointment.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">
                            {appointment.patient?.full_name ?? "Bệnh nhân"}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {appointment.doctor?.profile?.full_name ?? "—"} ·{" "}
                            {formatTime(appointment.time_slot)}
                          </p>
                        </div>
                        <AppointmentStatusBadge status={appointment.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {appointment.patient?.phone ?? "—"}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => checkInMutation.mutate(appointment.id)}
                        disabled={checkInMutation.isPending && checkInMutation.variables === appointment.id}
                      >
                        <UserCheck className="h-4 w-4" /> Check-in
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {checkedIn.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold">
                Đã check-in <Badge variant="secondary">{checkedIn.length}</Badge>
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {checkedIn.map((appointment) => (
                  <Card key={appointment.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">
                            {appointment.patient?.full_name ?? "Bệnh nhân"}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {appointment.doctor?.profile?.full_name ?? "—"} ·{" "}
                            {formatTime(appointment.time_slot)}
                          </p>
                        </div>
                        <AppointmentStatusBadge status={appointment.status} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <span className="text-xs text-muted-foreground">
                        {appointment.patient?.phone ?? "—"}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}