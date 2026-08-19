import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, PackageCheck, CheckCheck, Send, Phone, MessageSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { DetailSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { PrescriptionStatusBadge } from "@/components/shared/StatusBadge";
import { getPrescriptionById, updatePrescriptionStatus } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { PrescriptionStatus } from "@/types";

export function PrescriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: prescription, isLoading } = useQuery({
    queryKey: ["prescription", id],
    queryFn: () => getPrescriptionById(id!),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PrescriptionStatus }) => {
      await updatePrescriptionStatus(id, status);
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.status === "delivered"
          ? "Đã bàn giao & hóa đơn đã thanh toán"
          : "Đã cập nhật đơn thuốc",
      );
      queryClient.invalidateQueries({ queryKey: ["prescription", id] });
      queryClient.invalidateQueries({ queryKey: ["pharmacy-prescriptions"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <DetailSkeleton />;
  if (!prescription) {
    return (
      <EmptyState title="Không tìm thấy" description="Đơn thuốc này không tồn tại." />
    );
  }

  const total = prescription.items.reduce(
    (sum, item) => sum + (item.medication?.price ?? 0) * item.quantity,
    0,
  );

  const nextAction: { status: PrescriptionStatus; label: string; icon: typeof Send } | null =
    prescription.status === "sent"
      ? { status: "preparing", label: "Bắt đầu chuẩn bị", icon: PackageCheck }
      : prescription.status === "preparing"
          ? { status: "ready", label: "Đánh dấu sẵn sàng", icon: CheckCheck }
        : prescription.status === "ready"
          ? { status: "delivered", label: "Đánh dấu đã bàn giao", icon: Send }
          : null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/app/pharmacy/queue">
          <ArrowLeft className="h-4 w-4" /> Quay lại hàng đợi
        </Link>
      </Button>

      <PageHeader
        title="Đơn thuốc"
        description={`Cấp lúc ${formatDateTime(prescription.created_at)}`}
      >
        <PrescriptionStatusBadge status={prescription.status} />
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bệnh nhân</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{prescription.patient?.full_name ?? "—"}</p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" /> {prescription.patient?.phone ?? "—"}
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <MessageSquare className="h-4 w-4" /> {prescription.patient?.email ?? "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Chi tiết thuốc</CardTitle>
                <CardDescription>
                  Tồn kho được trừ tự động khi đơn thuốc được gửi.
                </CardDescription>
              </div>
              {nextAction ? (
                <Button
                  onClick={() =>
                    statusMutation.mutate({ id: prescription.id, status: nextAction.status })
                  }
                  disabled={statusMutation.isPending}
                >
                  <nextAction.icon className="h-4 w-4" /> {nextAction.label}
                </Button>
              ) : (
                <Badge variant="success" className="shrink-0">
                  Hoàn tất
                </Badge>
              )}
            </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {prescription.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.medication?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.dosage ? `${item.dosage} · ` : ""}
                      SL {item.quantity}
                      {item.instructions ? ` · ${item.instructions}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency((item.medication?.price ?? 0) * item.quantity)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Còn lại: {item.medication?.stock_qty ?? "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <span className="text-sm font-semibold">Tổng cộng: {formatCurrency(total)}</span>
            </div>
          </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ghi chú của bác sĩ</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {prescription.notes ? (
                <p className="whitespace-pre-line text-muted-foreground">{prescription.notes}</p>
              ) : (
                <p className="text-muted-foreground">Không có ghi chú</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}