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
      toast.success("Patient checked in");
      queryClient.invalidateQueries({ queryKey: ["today-checkin"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const pending = appointments.filter((a) => a.status === "pending" || a.status === "confirmed");
  const checkedIn = appointments.filter((a) => a.status === "checked-in" || a.status === "in-progress");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient Check-in"
        description="Confirm arrival for today's appointments"
      />

      {isLoading ? (
        <CardGridSkeleton className="md:grid-cols-2 lg:grid-cols-3" />
      ) : (
        <>
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              Awaiting check-in <Badge variant="secondary">{pending.length}</Badge>
            </h2>
            {pending.length === 0 ? (
              <EmptyState title="Nothing to check in" description="No pending appointments today." />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {pending.map((appointment) => (
                  <Card key={appointment.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">
                            {appointment.patient?.full_name ?? "Patient"}
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
                        disabled={checkInMutation.isPending}
                      >
                        <UserCheck className="h-4 w-4" /> Check in
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
                Checked in <Badge variant="secondary">{checkedIn.length}</Badge>
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {checkedIn.map((appointment) => (
                  <Card key={appointment.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        {appointment.patient?.full_name ?? "Patient"}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {formatTime(appointment.time_slot)}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <AppointmentStatusBadge status={appointment.status} />
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