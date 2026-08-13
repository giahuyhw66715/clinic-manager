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
      toast.success(editor.medication ? "Medication updated" : "Medication created");
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
      toast.success("Medication deleted");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Medication stock and dispensing catalog"
      >
        <Button onClick={() => openEditor()}>
          <Plus className="h-4 w-4" /> Add medication
        </Button>
      </PageHeader>

      {lowCount > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-amber-800">
            <TriangleAlert className="h-5 w-5 shrink-0" />
            <span>
              <span className="font-semibold">{lowCount} medication(s)</span> at or below their
              reorder level. Restock soon to avoid holding up prescriptions.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name..."
          className="w-full max-w-sm"
        />
        <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "low")}>
          <TabsList>
            <TabsTrigger value="all">All ({medications.length})</TabsTrigger>
            <TabsTrigger value="low">Low stock ({lowCount})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex flex-wrap gap-2">
        {medications.filter((m) => m.stock_qty <= m.reorder_level).slice(0, 8).map((m) => (
          <Badge key={m.id} variant="warning">
            {m.name}: {m.stock_qty} left
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tab === "low" ? "No low-stock items" : "No medications"}
          description={
            tab === "low"
              ? "All medications are above their reorder level."
              : "Add medications to build your catalog."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Reorder at</TableHead>
                <TableHead className="w-24">Actions</TableHead>
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
                        title="Delete medication?"
                        description={`Delete "${medication.name}" from the catalog?`}
                        confirmLabel="Delete"
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
            <DialogTitle>{editor.medication ? "Edit medication" : "Add medication"}</DialogTitle>
            <DialogDescription>
              Define the medication used in prescriptions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Paracetamol"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Dosage unit</Label>
                <Input
                  value={form.dosage_unit}
                  onChange={(e) => setForm((f) => ({ ...f, dosage_unit: e.target.value }))}
                  placeholder="tablet"
                  maxLength={100}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                maxLength={100}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.stock_qty}
                  onChange={(e) => setForm((f) => ({ ...f, stock_qty: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Reorder at</Label>
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
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}