import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronsUpDown, Pill, Plus, Trash2, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { createPrescription, getDrugInteractions, getMedications, getPatientAllergies } from "@/lib/api";
import { createNotification } from "@/hooks/useNotifications";
import { supabase } from "@/lib/supabase";
import { cn, formatCurrency } from "@/lib/utils";

interface PrescriptionLine {
  medicationId: string;
  dosage: string;
  quantity: string;
  instructions: string;
}

interface PrescriptionFormProps {
  patientId: string;
  doctorId: string;
  appointmentId?: string | null;
  onSuccess?: () => void;
}

export function PrescriptionForm({
  patientId,
  doctorId,
  appointmentId,
  onSuccess,
}: PrescriptionFormProps) {
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<PrescriptionLine[]>([
    { medicationId: "", dosage: "", quantity: "1", instructions: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [openCombo, setOpenCombo] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: medications = [] } = useQuery({ queryKey: ["medications"], queryFn: getMedications });
  const { data: allergies = [] } = useQuery({
    queryKey: ["patient-allergies", patientId],
    queryFn: () => getPatientAllergies(patientId),
    enabled: !!patientId,
  });
  const { data: interactions = [] } = useQuery({
    queryKey: ["drug-interactions"],
    queryFn: getDrugInteractions,
  });

  const patientProfile = useQuery({
    queryKey: ["patient-profile", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,allergies,phone")
        .eq("id", patientId)
        .single();
      return data as { id: string; full_name: string | null; allergies: string | null; phone: string | null } | null;
    },
    enabled: !!patientId,
  });

  const filteredMedications = useMemo(() => {
    const q = search.toLowerCase();
    return medications.filter((m) => m.name.toLowerCase().includes(q));
  }, [medications, search]);

  const allergenWarnings = useMemo(() => {
    const result: string[] = [];
    for (const line of lines) {
      const medication = medications.find((m) => m.id === line.medicationId);
      if (!medication) continue;
      const match = allergies.filter(
        (a) => a.medication_id === medication.id || (a.allergen ?? "").toLowerCase() === medication.name.toLowerCase(),
      );
      for (const a of match) {
        result.push(`${medication.name} — bệnh nhân dị ứng (${a.severity}). ${a.allergen ?? ""}`.trim());
      }
      if (
        patientProfile.data?.allergies &&
        patientProfile.data.allergies.toLowerCase().includes(medication.name.toLowerCase())
      ) {
        result.push(`${medication.name} — trùng với dị ứng đã ghi nhận trong hồ sơ bệnh nhân.`);
      }
    }
    return result;
  }, [lines, medications, allergies, patientProfile.data]);

  const interactionWarnings = useMemo(() => {
    const result: string[] = [];
    for (const line of lines) {
      for (const other of lines) {
        if (line === other || !line.medicationId || !other.medicationId) continue;
        const pair = interactions.find(
          (i) =>
            (i.medication_a_id === line.medicationId && i.medication_b_id === other.medicationId) ||
            (i.medication_a_id === other.medicationId && i.medication_b_id === line.medicationId),
        );
        if (pair) {
          const a = medications.find((m) => m.id === pair.medication_a_id)?.name;
          const b = medications.find((m) => m.id === pair.medication_b_id)?.name;
          result.push(
            `${a} + ${b} — có thể tương tác thuốc (${pair.severity}). ${pair.description ?? ""}`.trim(),
          );
        }
      }
    }
    return [...new Set(result)];
  }, [lines, interactions, medications]);

  const stockWarnings = useMemo(() => {
    const result: string[] = [];
    for (const line of lines) {
      const medication = medications.find((m) => m.id === line.medicationId);
      if (!medication) continue;
      if (medication.stock_qty <= 0) {
        result.push(`${medication.name} đã hết hàng.`);
      } else if (Number(line.quantity) > medication.stock_qty) {
        result.push(
          `${medication.name}: yêu cầu ${line.quantity}, chỉ còn ${medication.stock_qty} trong kho.`,
        );
      }
    }
    return result;
  }, [lines, medications]);

  const isValid =
    lines.some((l) => l.medicationId) &&
    lines.every((l) => {
      if (!l.medicationId) return true;
      const med = medications.find((m) => m.id === l.medicationId);
      const qty = Number(l.quantity);
      return qty > 0 && !!med && qty <= med.stock_qty;
    });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isValid) throw new Error("Vui lòng điền ít nhất một dòng");
      const items = lines
        .filter((l) => l.medicationId)
        .map((l) => ({
          medication_id: l.medicationId,
          dosage: l.dosage || undefined,
          quantity: Number(l.quantity),
          instructions: l.instructions || undefined,
        }));
      await createPrescription({
        appointment_id: appointmentId ?? null,
        patient_id: patientId,
        doctor_id: doctorId,
        notes: notes || undefined,
        items,
      });
      await createNotification(patientId, {
        type: "prescription",
        title: "Đơn thuốc mới đã được kê",
        body: `Đơn thuốc mới (${items.length} mục) đã được gửi tới nhà thuốc.`,
      });
    },
    onSuccess: () => {
      toast.success("Đã gửi đơn thuốc cho nhà thuốc");
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      onSuccess?.();
      setLines([{ medicationId: "", dosage: "", quantity: "1", instructions: "" }]);
      setNotes("");
    },
    onError: (error) => toast.error(error.message),
  });

  function updateLine(index: number, patch: Partial<PrescriptionLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {lines.map((line, index) => {
          const medication = medications.find((m) => m.id === line.medicationId);
          return (
            <div key={index} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Thuốc {index + 1}</span>
                </div>
                {lines.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              <Popover
                open={openCombo === index}
                onOpenChange={(open) => {
                  setOpenCombo(open ? index : null);
                  if (open) setSearch("");
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombo === index}
                    className="w-full justify-between"
                  >
                    {medication ? medication.name : "Tìm thuốc..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Tìm theo tên..."
                      value={search}
                      onValueChange={setSearch}
                      className="h-9"
                    />
                    <CommandList>
                      <CommandEmpty>Không tìm thấy thuốc</CommandEmpty>
                      <CommandGroup>
                        {filteredMedications.map((med) => (
                          <CommandItem
                            key={med.id}
                            value={med.id}
                            onSelect={() => {
                              updateLine(index, { medicationId: med.id });
                              setOpenCombo(null);
                            }}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0",
                                line.medicationId === med.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="flex w-full items-center justify-between">
                              <span>{med.name}</span>
                              <div className="flex items-center gap-2">
                                {med.stock_qty <= med.reorder_level && (
                                  <Badge variant={med.stock_qty <= 0 ? "destructive" : "warning"}>
                                    {med.stock_qty <= 0 ? "Hết hàng" : "Sắp hết"}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatCurrency(med.price)}
                                </span>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Liều dùng</Label>
                  <Input
                    placeholder="VD: 500mg 3 lần/ngày"
                    value={line.dosage}
                    onChange={(e) => updateLine(index, { dosage: e.target.value })}
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Số lượng</Label>
                  <Input
                    type="number"
                    min={1}
                    max={medication ? medication.stock_qty : undefined}
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Hướng dẫn</Label>
                  <Input
                    placeholder="VD: uống sau bữa ăn"
                    value={line.instructions}
                    onChange={(e) => updateLine(index, { instructions: e.target.value })}
                    maxLength={100}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() =>
            setLines((prev) => [
              ...prev,
              { medicationId: "", dosage: "", quantity: "1", instructions: "" },
            ])
          }
        >
          <Plus className="h-4 w-4" /> Thêm thuốc
        </Button>
      </div>

      {allergenWarnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cảnh báo dị ứng</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc space-y-1">
              {allergenWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {interactionWarnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle>Cảnh báo tương tác thuốc</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc space-y-1">
              {interactionWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {stockWarnings.length > 0 && (
        <Alert variant="destructive">
          <X className="h-4 w-4" />
          <AlertTitle>Cảnh báo tồn kho</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc space-y-1">
              {stockWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div>
        <Label className="text-xs text-muted-foreground">
          Ghi chú đơn thuốc (tùy chọn)
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Hướng dẫn thêm cho nhà thuốc..."
          rows={2}
          maxLength={300}
        />
      </div>

      <Button
        className="w-full"
        disabled={!isValid || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Đang gửi..." : "Gửi đơn thuốc cho nhà thuốc"}
      </Button>
    </div>
  );
}