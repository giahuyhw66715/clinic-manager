import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarX, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  createDoctorOffDay,
  deleteDoctorOffDay,
  getDoctorByUserId,
  getDoctorOffDays,
  getDoctorSchedules,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { dayOfWeekLabel, formatTime } from "@/lib/utils";

export function MySchedulePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [offDate, setOffDate] = useState<Date | undefined>(undefined);
  const [reason, setReason] = useState("");

  const { data: doctor } = useQuery({
    queryKey: ["my-doctor", user?.id],
    queryFn: () => getDoctorByUserId(user!.id),
    enabled: !!user,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["doctor-schedules", doctor?.id],
    queryFn: () => getDoctorSchedules(doctor!.id),
    enabled: !!doctor,
  });

  const { data: offDays = [] } = useQuery({
    queryKey: ["doctor-off-days", doctor?.id],
    queryFn: () => getDoctorOffDays(doctor!.id),
    enabled: !!doctor,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["doctor-schedules"] });
    queryClient.invalidateQueries({ queryKey: ["doctor-off-days"] });
  };

  const addOffDayMutation = useMutation({
    mutationFn: async () => {
      if (!doctor || !offDate) return;
      await createDoctorOffDay({
        doctor_id: doctor.id,
        off_date: offDate.toISOString().slice(0, 10),
        reason: reason || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Day off recorded");
      setOffDate(undefined);
      setReason("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeOffDayMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoctorOffDay(id);
    },
    onSuccess: () => {
      toast.success("Removed");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Schedule"
        description="Your weekly working hours and days off"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekly working hours</CardTitle>
          </CardHeader>
          <CardContent>
            {schedules.length === 0 ? (
              <EmptyState
                title="No schedule set"
                description="Your admin has not configured your weekly schedule yet."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Slot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...schedules]
                    .sort((a, b) => a.day_of_week - b.day_of_week)
                    .map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium">
                          {dayOfWeekLabel(schedule.day_of_week)}
                        </TableCell>
                        <TableCell>{formatTime(schedule.start_time)}</TableCell>
                        <TableCell>{formatTime(schedule.end_time)}</TableCell>
                        <TableCell>{schedule.slot_minutes} min</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Days off</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarX className="mr-2 h-4 w-4" />
                    {offDate ? format(offDate, "MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={offDate}
                    onSelect={setOffDate}
                    disabled={(d) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return d < today;
                    }}
                  />
                </PopoverContent>
              </Popover>
              <Input
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={100}
              />
              <Button
                onClick={() => addOffDayMutation.mutate()}
                disabled={!offDate || addOffDayMutation.isPending}
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>

            <Separator />

            {offDays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No days off recorded.</p>
            ) : (
              <ul className="space-y-2">
                {offDays.map((off) => (
                  <li
                    key={off.id}
                    className="flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{format(parseISO(off.off_date), "MMM d, yyyy")}</p>
                      {off.reason && (
                        <p className="text-xs text-muted-foreground">{off.reason}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeOffDayMutation.mutate(off.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}