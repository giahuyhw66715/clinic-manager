import { useEffect, useState } from "react";
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
  const [offDays, setOffDays] = useState<Set<number>>(new Set());

  const { data: doctors = [], isLoading } = useQuery({ queryKey: ["doctors"], queryFn: getDoctors });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: getDepartments });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: getProfiles });

  const doctorCandidates = profiles.filter(
    (p) => p.role === "doctor" && !doctors.some((d) => d.user_id === p.id),
  );

  const { data: doctorSchedules = [], isLoading: schedulesLoading } = useQuery({
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
  }

  useEffect(() => {
    if (!schedulesFor) return;
    setScheduleDrafts({});
    setOffDay("");
    const scheduled = new Set(doctorSchedules.map((s) => s.day_of_week));
    setOffDays(new Set(DAYS.filter((day) => !scheduled.has(day))));
  }, [schedulesFor, doctorSchedules]);

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

  function isInvalidSlot(slot: string) {
    return slot.trim() !== "" && (Number.isNaN(Number(slot)) || Number(slot) < 10);
  }

  const hasSlotError = DAYS.some((day) => {
    const draft = scheduleDrafts[day];
    return draft != null && isInvalidSlot(draft.slot);
  });

  const saveDoctorMutation = useMutation({
    mutationFn: async () => {
      const fee = Number(form.consultation_fee);
      if (Number.isNaN(fee) || fee < 0) throw new Error("Phí khám không được nhỏ hơn 0");
      const payload = {
        user_id: form.user_id,
        department_id: form.department_id,
        specialty: form.specialty,
        consultation_fee: fee || 0,
        bio: form.bio || undefined,
      };
      if (editing) {
        await updateDoctor(editing.id, payload);
      } else {
        await createDoctor(payload);
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Đã cập nhật bác sĩ" : "Đã thêm bác sĩ");
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
      toast.success("Đã xóa bác sĩ");
      invalidateDoctors();
    },
    onError: (e) => toast.error(e.message),
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!schedulesFor) return;
      for (const day of DAYS) {
        if (offDays.has(day)) {
          const existing = doctorSchedules.find((s) => s.day_of_week === day);
          if (existing) await deleteDoctorSchedule(existing.id);
          continue;
        }
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
      toast.success("Đã lưu lịch làm việc");
      queryClient.invalidateQueries({ queryKey: ["doctor-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-off-days"] });
      setScheduleDrafts({});
      setOffDay("");
    },
    onError: (e) => toast.error(e.message),
  });

  const clearDayMutation = useMutation({
    mutationFn: async (day: number) => {
      if (!schedulesFor) return;
      const existing = doctorSchedules.find((s) => s.day_of_week === day);
      if (existing) await deleteDoctorSchedule(existing.id);
      setScheduleDrafts((d) => ({ ...d, [day]: { start: "", end: "", slot: "30" } }));
      setOffDays((prev) => new Set(prev).add(day));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-schedules"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const addOffDayMutation = useMutation({
    mutationFn: async () => {
      if (!schedulesFor || !offDay) return;
      await createDoctorOffDay({ doctor_id: schedulesFor.id, off_date: offDay });
    },
    onSuccess: () => {
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

  const fee = Number(form.consultation_fee);
  const feeError =
    form.consultation_fee.trim() !== "" && (Number.isNaN(fee) || fee < 0)
      ? "Phí khám không được nhỏ hơn 0"
      : "";

  return (
    <div className="space-y-6">
      <PageHeader title="Bác sĩ & Lịch làm việc" description="Quản lý đội ngũ y tế">
        <Button onClick={() => openEditor()}>
          <Plus className="h-4 w-4" /> Thêm bác sĩ
        </Button>
      </PageHeader>

      {isLoading ? (
        <TableSkeleton />
      ) : doctors.length === 0 ? (
        <EmptyState
          title="Chưa có bác sĩ nào"
          description="Nâng vai trò người dùng thành bác sĩ, sau đó thêm họ vào đây."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bác sĩ</TableHead>
                <TableHead>Khoa khám</TableHead>
                <TableHead>Chuyên khoa</TableHead>
                <TableHead className="text-right">Phí khám</TableHead>
                <TableHead className="w-36">Thao tác</TableHead>
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
                        title="Xóa bác sĩ?"
                        description={`Xóa ${doctor.profile?.full_name ?? "bác sĩ này"} khỏi phòng khám?`}
                        confirmLabel="Xóa"
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
            <DialogTitle>{editing ? "Chỉnh sửa bác sĩ" : "Thêm bác sĩ"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Cập nhật thông tin bác sĩ."
                : "Chọn người dùng có vai trò bác sĩ."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tài khoản bác sĩ *</Label>
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
                    <SelectValue placeholder="Chọn người dùng có vai trò bác sĩ" />
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
                <Label>Khoa khám *</Label>
                <Select
                  value={form.department_id || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, department_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn khoa khám" />
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
                <Label>Chuyên khoa *</Label>
                <Input
                  value={form.specialty}
                  onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                  placeholder="Nội khoa"
                  maxLength={100}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Phí khám</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.consultation_fee}
                  onChange={(e) => setForm((f) => ({ ...f, consultation_fee: e.target.value }))}
                  aria-invalid={!!feeError}
                  className={feeError ? "border-destructive" : undefined}
                />
                {feeError && <p className="text-xs text-destructive">{feeError}</p>}
              </div>
              {/* spacer */}
            </div>
            <div className="space-y-2">
              <Label>Giới thiệu</Label>
              <Input
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Giới thiệu ngắn (tùy chọn)"
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
                !!feeError ||
                saveDoctorMutation.isPending
              }
            >
              {saveDoctorMutation.isPending ? "Đang lưu..." : "Lưu"}
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
              {schedulesFor?.profile?.full_name ?? "Bác sĩ"} — Lịch làm việc tuần
            </DialogTitle>
            <DialogDescription>
              Thiết lập các suất khám lặp lại theo ngày trong tuần. Dùng nút "Nghỉ" để tắt cả ngày.
            </DialogDescription>
          </DialogHeader>

          {schedulesLoading ? (
            <p className="py-4 text-sm text-muted-foreground">Đang tải lịch làm việc...</p>
          ) : (
          <div className="space-y-2">
            {DAYS.map((day) => {
              const draft = buildDraft(day);
              const isOff = offDays.has(day);
              return (
                <div key={day} className="flex items-center gap-2">
                  <div className="w-24 shrink-0 py-2 text-sm font-medium">
                    {dayOfWeekLabel(day)}
                  </div>
                  {isOff ? (
                    <div className="flex flex-1 items-center justify-between rounded-md border border-dashed px-3 py-2">
                      <span className="text-sm text-muted-foreground">Nghỉ cả ngày</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOffDays((prev) => {
                            const next = new Set(prev);
                            next.delete(day);
                            return next;
                          });
                          setScheduleDrafts((d) => ({
                            ...d,
                            [day]: { start: "08:00", end: "17:00", slot: "30" },
                          }));
                        }}
                      >
                        Làm lại
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Bắt đầu</Label>
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
                          <Label className="text-xs text-muted-foreground">Kết thúc</Label>
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
                          <Label className="text-xs text-muted-foreground">Suất khám</Label>
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
                            aria-invalid={isInvalidSlot(draft.slot)}
                          />
                          {isInvalidSlot(draft.slot) && (
                            <p className="text-[10px] text-destructive">Tối thiểu 10 phút</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {draft.id && (
                          <Badge variant="secondary" className="mb-1.5">
                            đã lưu
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={clearDayMutation.isPending}
                          onClick={() => clearDayMutation.mutate(day)}
                        >
                          Nghỉ
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          )}

          <Separator />
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">Ngày nghỉ</Label>
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
                Thêm
              </Button>
            </div>
            {doctorOffDays.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {doctorOffDays.map((off) => (
                  <Badge key={off.id} variant="outline" className="gap-1">
                    {format(parseISO(off.off_date), "dd/MM/yyyy")}
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
              disabled={saveScheduleMutation.isPending || hasSlotError}
            >
              {saveScheduleMutation.isPending ? "Đang lưu..." : "Lưu lịch làm việc"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}