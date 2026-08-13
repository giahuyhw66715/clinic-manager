import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Department } from "@/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  createDepartment,
  deleteDepartment,
  getDepartments,
  updateDepartment,
} from "@/lib/api";

export function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["departments"] });

  function openEditor(department?: Department) {
    setEditing(department ?? null);
    setName(department?.name ?? "");
    setDescription(department?.description ?? "");
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateDepartment(editing.id, { name, description });
      } else {
        await createDepartment({ name, description });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Đã cập nhật khoa khám" : "Đã thêm khoa khám");
      setOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDepartment(id);
    },
    onSuccess: () => {
      toast.success("Đã xóa khoa khám");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Khoa khám" description="Sắp xếp bác sĩ theo chuyên khoa">
        <Button onClick={() => openEditor()}>
          <Plus className="h-4 w-4" /> Khoa khám mới
        </Button>
      </PageHeader>

      {isLoading ? (
        <CardGridSkeleton />
      ) : departments.length === 0 ? (
        <EmptyState title="Chưa có khoa khám" description="Tạo khoa khám để sắp xếp bác sĩ." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((department) => (
            <Card key={department.id}>
              <CardHeader>
                <CardTitle className="text-base">{department.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {department.description ?? "Không có mô tả"}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditor(department)}>
                    <Pencil className="h-3 w-3" /> Chỉnh sửa
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm" className="text-destructive">
                        <Trash2 className="h-3 w-3" /> Xóa
                      </Button>
                    }
                    title="Xóa khoa khám?"
                    description={`Xóa khoa "${department.name}"? Các bác sĩ thuộc khoa này có thể bị mất phân công.`}
                    confirmLabel="Xóa"
                    onConfirm={() => deleteMutation.mutate(department.id)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Chỉnh sửa khoa khám" : "Khoa khám mới"}</DialogTitle>
            <DialogDescription>Nhập thông tin khoa khám.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tên *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tim mạch" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả (tùy chọn)"
                maxLength={300}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}