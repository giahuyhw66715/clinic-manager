import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Pencil, Plus, Stethoscope, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  createDoctor,
  createDoctorOffDay,
  deleteDoctor,
  deleteDoctorOffDay,
  deleteDoctorSchedule,
  getDepartments,
  getDoctorOffDays,
  getDoctorSchedules,
  getDoctors,
  getProfiles,
  updateDoctor,
  upsertDoctorSchedule,
} from "@/lib/api";
import { dayOfWeekLabel, formatCurrency } from "@/lib/utils";
import type { Doctor } from "@/types";

const DAYS = [0, 1, 2, 3, 4, 5, 6];

interface DoctorForm {
  user_id: string;
  department_id: string;
  specialty: string;
  consultation_fee: string;
  bio: string;
}

const emptyForm: DoctorForm = {
  user_id: "",
  department_id: "",
  specialty: "",
  consultation_fee: "0",
  bio: "",
};

export function DoctorsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState<DoctorForm>(emptyForm);
  const [schedulesFor, setSchedulesFor] = useState<Doctor | null>(null);
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<number, { id?: string; start: string; end: string; slot: string }>>({});
  const [offDay, setOffDay] = useState<string>("");

  const { data: doctors = [], isLoading } = useQuery({ queryKey: ["doctors"], queryFn: getDoctors });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: getDepartments });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: getProfiles });

  const doctorCandidates = profiles.filter(
    (p) => p.role === "doctor" && !doctors.some((d) => d.user_id === p.id),
  );

  const { data: doctorSchedules = [] } = useQuery({
    queryKey: ["doctor-schedules", schedulesFor?.id],
    queryFn: () => getDoctorSchedules(schedulesFor!.id),
    enabled: !!schedulesFor,
  });
  const { data: doctorOffDays = [] } = useQuery({
    queryKey: ["doctor-off-days", schedulesFor?.id],
    queryFn: () => getDoctorOffDays(schedulesFor!.id),
    enabled: !!schedulesFor,
  });

  const invalidateDoctors = () => queryClient.invalidateQueries({ queryKey: ["doctors"] });

  function openEditor(doctor?: Doctor) {
    setEditing(doctor ?? null);
    setForm(
      doctor
        ? {
            user_id: doctor.user_id,
            department_id: doctor.department_id ?? "",
            specialty: doctor.specialty ?? "",
            consultation_fee: String(doctor.consultation_fee ?? 0),
            bio: doctor.bio ?? "",
          }
        : emptyForm,
    );
    setDialogOpen(true);
  }

  function openSchedules(doctor: Doctor) {
    setSchedulesFor(doctor);
    setScheduleDrafts({});
    setOffDay("");
  }

  function buildDraft(day: number) {
    const existing = doctorSchedules.find((s) => s.day_of_week === day);
    return (
      scheduleDrafts[day] ?? {
        id: existing?.id,
        start: existing ? existing.start_time.slice(0, 5) : "08:00",
        end: existing ? existing.end_time.slice(0, 5) : "17:00",
        slot: String(existing?.slot_minutes ?? 30),
      }
    );
  }

  const saveDoctorMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: form.user_id,
        department_id: form.department_id,
        specialty: form.specialty,
        consultation_fee: Number(form.consultation_fee) || 0,
        bio: form.bio || undefined,
      };
      if (editing) {
        await updateDoctor(editing.id, payload);
      } else {
        await createDoctor(payload);
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Doctor updated" : "Doctor created");
      setDialogOpen(false);
      invalidateDoctors();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteDoctorMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoctor(id);
    },
    onSuccess: () => {
      toast.success("Doctor removed");
      invalidateDoctors();
    },
    onError: (e) => toast.error(e.message),
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!schedulesFor) return;
      for (const day of DAYS) {
        const draft = scheduleDrafts[day];
        if (!draft) continue;
        if (!draft.end || !draft.start) {
          if (draft.id) await deleteDoctorSchedule(draft.id);
          continue;
        }
        await upsertDoctorSchedule({
          id: draft.id ?? undefined,
          doctor_id: schedulesFor.id,
          day_of_week: day,
          start_time: draft.start + ":00",
          end_time: draft.end + ":00",
          slot_minutes: Number(draft.slot) || 30,
        });
      }
    },
    onSuccess: () => {
      toast.success("Schedules saved");
      queryClient.invalidateQueries({ queryKey: ["doctor-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-off-days"] });
      setScheduleDrafts({});
    },
    onError: (e) => toast.error(e.message),
  });

  const addOffDayMutation = useMutation({
    mutationFn: async () => {
      if (!schedulesFor || !offDay) return;
      await createDoctorOffDay({ doctor_id: schedulesFor.id, off_date: offDay });
    },
    onSuccess: () => {
      toast.success("Day off added");
      setOffDay("");
      queryClient.invalidateQueries({ queryKey: ["doctor-off-days"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const removeOffDayMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoctorOffDay(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-off-days"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Doctors & Schedules" description="Manage medical staff">
        <Button onClick={() => openEditor()}>
          <Plus className="h-4 w-4" /> Add doctor
        </Button>
      </PageHeader>

      {isLoading ? (
        <TableSkeleton />
      ) : doctors.length === 0 ? (
        <EmptyState
          title="No doctors yet"
          description="Promote a user to doctor role, then add them here."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead className="w-36">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.map((doctor) => (
                <TableRow key={doctor.id}>
                  <TableCell className="font-medium">
                    {doctor.profile?.full_name ?? "—"}
                  </TableCell>
                  <TableCell>{doctor.department?.name ?? "—"}</TableCell>
                  <TableCell>{doctor.specialty ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(doctor.consultation_fee)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSchedules(doctor)}>
                        <CalendarDays className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(doctor)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                        title="Remove doctor?"
                        description={`Remove ${doctor.profile?.full_name ?? "this doctor"} from the practice?`}
                        confirmLabel="Remove"
                        onConfirm={() => deleteDoctorMutation.mutate(doctor.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Doctor edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit doctor" : "Add doctor"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update doctor details."
                : "Select a user with the doctor role."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Doctor account *</Label>
              {editing ? (
                <Input
                  value={editing.profile?.full_name ?? editing.profile?.email ?? ""}
                  disabled
                />
              ) : (
                <Select
                  value={form.user_id || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, user_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user with doctor role" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctorCandidates.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? p.email ?? p.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Department *</Label>
                <Select
                  value={form.department_id || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, department_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Specialty *</Label>
                <Input
                  value={form.specialty}
                  onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                  placeholder="Internal Medicine"
                  maxLength={100}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Consultation fee</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.consultation_fee}
                  onChange={(e) => setForm((f) => ({ ...f, consultation_fee: e.target.value }))}
                />
              </div>
              {/* spacer */}
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Input
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Short bio (optional)"
                maxLength={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => saveDoctorMutation.mutate()}
              disabled={
                (!editing && !form.user_id) ||
                !form.department_id ||
                !form.specialty.trim() ||
                saveDoctorMutation.isPending
              }
            >
              {saveDoctorMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedules dialog */}
      <Dialog open={!!schedulesFor} onOpenChange={(open) => !open && setSchedulesFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              {schedulesFor?.profile?.full_name ?? "Doctor"} — Weekly schedule
            </DialogTitle>
            <DialogDescription>
              Set recurring slots per weekday. Leave a row empty to disable that day.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {DAYS.map((day) => {
              const draft = buildDraft(day);
              return (
                <div key={day} className="flex items-end gap-2">
                  <div className="w-24 shrink-0 py-2 text-sm font-medium">
                    {dayOfWeekLabel(day)}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Start</Label>
                      <Input
                        type="time"
                        className="h-8 w-28"
                        value={draft.start}
                        onChange={(e) =>
                          setScheduleDrafts((d) => ({
                            ...d,
                            [day]: { ...draft, start: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">End</Label>
                      <Input
                        type="time"
                        className="h-8 w-28"
                        value={draft.end}
                        onChange={(e) =>
                          setScheduleDrafts((d) => ({
                            ...d,
                            [day]: { ...draft, end: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Slots</Label>
                      <Input
                        type="number"
                        className="h-8 w-20"
                        min={10}
                        value={draft.slot}
                        onChange={(e) =>
                          setScheduleDrafts((d) => ({
                            ...d,
                            [day]: { ...draft, slot: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                  {draft.id && (
                    <Badge variant="secondary" className="mb-1.5">
                      set
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          <Separator />
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">Days off</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={offDay}
                onChange={(e) => setOffDay(e.target.value)}
                className="w-44"
              />
              <Button
                size="sm"
                onClick={() => addOffDayMutation.mutate()}
                disabled={!offDay}
              >
                Add
              </Button>
            </div>
            {doctorOffDays.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {doctorOffDays.map((off) => (
                  <Badge key={off.id} variant="outline" className="gap-1">
                    {format(parseISO(off.off_date), "MMM d, yyyy")}
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeOffDayMutation.mutate(off.id)}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => saveScheduleMutation.mutate()}
              disabled={saveScheduleMutation.isPending}
            >
              {saveScheduleMutation.isPending ? "Saving..." : "Save schedules"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}