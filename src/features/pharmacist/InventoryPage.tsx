import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, TriangleAlert, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { createMedication, deleteMedication, getMedications, updateMedication } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { Medication } from "@/types";

type EditorState = { medication: Medication | null; open: boolean };

const emptyForm = {
  name: "",
  description: "",
  dosage_unit: "",
  price: "0",
  stock_qty: "0",
  reorder_level: "10",
};

export function InventoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "low">("all");
  const [editor, setEditor] = useState<EditorState>({ medication: null, open: false });
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  const { data: medications = [], isLoading } = useQuery({
    queryKey: ["medications"],
    queryFn: getMedications,
  });

  const filtered = medications.filter((m) => {
    const matchesSearch =
      !search || m.name.toLowerCase().includes(search.toLowerCase());
    const isLow = m.stock_qty <= m.reorder_level;
    return matchesSearch && (tab === "all" ? true : isLow);
  });

  const lowCount = medications.filter((m) => m.stock_qty <= m.reorder_level).length;

  function openEditor(medication?: Medication) {
    setEditor({ medication: medication ?? null, open: true });
    setForm(
      medication
        ? {
            name: medication.name,
            description: medication.description ?? "",
            dosage_unit: medication.dosage_unit ?? "",
            price: String(medication.price),
            stock_qty: String(medication.stock_qty),
            reorder_level: String(medication.reorder_level),
          }
        : emptyForm,
    );
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["medications"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        dosage_unit: form.dosage_unit || null,
        price: Number(form.price) || 0,
        stock_qty: Number(form.stock_qty) || 0,
        reorder_level: Number(form.reorder_level) || 0,
      };
      if (editor.medication) {
        await updateMedication(editor.medication.id, payload);
      } else {
        await createMedication(payload);
      }
    },
    onSuccess: () => {
      toast.success(editor.medication ? "Đã cập nhật thuốc" : "Đã thêm thuốc");
      setEditor({ medication: null, open: false });
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteMedication(id);
    },
    onSuccess: () => {
      toast.success("Đã xóa thuốc");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kho thuốc"
        description="Danh mục thuốc và tồn kho"
      >
        <Button onClick={() => openEditor()}>
          <Plus className="h-4 w-4" /> Thêm thuốc
        </Button>
      </PageHeader>

      {lowCount > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-amber-800">
            <TriangleAlert className="h-5 w-5 shrink-0" />
            <span>
              <span className="font-semibold">{lowCount} loại thuốc</span> đang ở mức dưới ngưỡng
              nhập lại. Hãy nhập thêm hàng để tránh gián đoạn đơn thuốc.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Tìm theo tên..."
          className="w-full max-w-sm"
        />
        <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "low")}>
          <TabsList>
            <TabsTrigger value="all">Tất cả ({medications.length})</TabsTrigger>
            <TabsTrigger value="low">Sắp hết ({lowCount})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex flex-wrap gap-2">
        {medications.filter((m) => m.stock_qty <= m.reorder_level).slice(0, 8).map((m) => (
          <Badge key={m.id} variant="warning">
            {m.name}: còn {m.stock_qty}
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tab === "low" ? "Không có thuốc sắp hết" : "Chưa có thuốc nào"}
          description={
            tab === "low"
              ? "Tất cả thuốc đều trên ngưỡng nhập lại."
              : "Thêm thuốc để xây dựng danh mục."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Đơn vị</TableHead>
                <TableHead className="text-right">Giá</TableHead>
                <TableHead className="text-right">Tồn kho</TableHead>
                <TableHead className="text-right">Ngưỡng nhập lại</TableHead>
                <TableHead className="w-24">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((medication) => (
                <TableRow key={medication.id}>
                  <TableCell className="font-medium">{medication.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {medication.description ?? "—"}
                  </TableCell>
                  <TableCell>{medication.dosage_unit ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(medication.price)}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        medication.stock_qty <= medication.reorder_level
                          ? "font-semibold text-destructive"
                          : ""
                      }
                    >
                      {medication.stock_qty}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{medication.reorder_level}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditor(medication)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                        title="Xóa thuốc?"
                        description={`Xóa thuốc "${medication.name}" khỏi danh mục?`}
                        confirmLabel="Xóa"
                        onConfirm={() => deleteMutation.mutate(medication.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={editor.open} onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor.medication ? "Chỉnh sửa thuốc" : "Thêm thuốc"}</DialogTitle>
            <DialogDescription>
              Thiết lập thuốc dùng trong đơn thuốc.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tên *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Paracetamol"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Đơn vị liều</Label>
                <Input
                  value={form.dosage_unit}
                  onChange={(e) => setForm((f) => ({ ...f, dosage_unit: e.target.value }))}
                  placeholder="viên"
                  maxLength={100}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Mô tả (tùy chọn)"
                maxLength={100}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Giá</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tồn kho</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.stock_qty}
                  onChange={(e) => setForm((f) => ({ ...f, stock_qty: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Ngưỡng nhập lại</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.reorder_level}
                  onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}