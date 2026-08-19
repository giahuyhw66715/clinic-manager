import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCheck, ClipboardList, Eye, PackageCheck, Pill, Send } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { Pagination, usePagination } from "@/components/shared/Pagination";
import { PrescriptionStatusBadge } from "@/components/shared/StatusBadge";
import { getPharmacyPrescriptions, updatePrescriptionStatus } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { PrescriptionStatus } from "@/types";

const statusTabs: { value: PrescriptionStatus | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "sent", label: "Đã gửi" },
  { value: "preparing", label: "Đang chuẩn bị" },
  { value: "ready", label: "Sẵn sàng" },
  { value: "delivered", label: "Đã bàn giao" },
];

export function PrescriptionQueuePage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<PrescriptionStatus | "all">("sent");

  const { data: prescriptions = [], isLoading } = useQuery({
    queryKey: ["pharmacy-prescriptions"],
    queryFn: getPharmacyPrescriptions,
  });

  useEffect(() => {
    const channel = supabase
      .channel("pharmacy-prescriptions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prescriptions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pharmacy-prescriptions"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filtered = useMemo(
    () => (tab === "all" ? prescriptions : prescriptions.filter((p) => p.status === tab)),
    [prescriptions, tab],
  );

  const paginated = usePagination(filtered);

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PrescriptionStatus }) => {
      await updatePrescriptionStatus(id, status);
    },
    onSuccess: () => {
      toast.success("Đã cập nhật đơn thuốc");
      queryClient.invalidateQueries({ queryKey: ["pharmacy-prescriptions"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hàng đợi đơn thuốc"
        description="Đơn thuốc mới từ bác sĩ hiển thị tại đây theo thời gian thực"
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as PrescriptionStatus | "all")}>
        <TabsList>
          {statusTabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <CardGridSkeleton className="lg:grid-cols-2" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tab === "all" ? "Chưa có đơn thuốc nào" : `Không có đơn thuốc ${tab}`}
          description="Đơn thuốc sẽ hiển thị tại đây ngay khi bác sĩ gửi."
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {paginated.items.map((prescription) => {
            const total = prescription.items.reduce(
              (sum, item) => sum + item.quantity * (item.medication?.price ?? 0),
              0,
            );
            return (
            <Card key={prescription.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{prescription.patient?.full_name ?? "Bệnh nhân"}</span>
                    </CardTitle>
                    <CardDescription>
                      {prescription.doctor?.profile?.full_name ?? "Không rõ"} ·{" "}
                      {formatDateTime(prescription.created_at)}
                    </CardDescription>
                  </div>
                  <PrescriptionStatusBadge status={prescription.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1.5">
                  {prescription.items.slice(0, 1).map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="truncate">
                        {item.medication?.name}{" "}
                        <span className="text-muted-foreground">× {item.quantity}</span>
                      </span>
                      {item.dosage && (
                        <span className="shrink-0 text-xs text-muted-foreground">{item.dosage}</span>
                      )}
                    </li>
                  ))}
                  <li className="flex items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    {prescription.items.length > 1 ? (
                      `+${prescription.items.length - 1} thuốc khác`
                    ) : (
                      <>
                        <Pill className="h-3.5 w-3.5" /> không còn thuốc nào
                      </>
                    )}
                  </li>
                </ul>

                <ExpandableText
                  text={prescription.notes}
                  emptyText="Không có ghi chú"
                  className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground"
                />

                <div className="flex items-end justify-between gap-3 border-t pt-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/app/pharmacy/prescriptions/${prescription.id}`}>
                        <Eye className="h-4 w-4" /> Xem chi tiết
                      </Link>
                    </Button>
                    {prescription.status === "sent" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        statusMutation.mutate({ id: prescription.id, status: "preparing" })
                      }
                      disabled={statusMutation.isPending && statusMutation.variables?.id === prescription.id}
                    >
                      <PackageCheck className="h-4 w-4" /> Bắt đầu chuẩn bị
                    </Button>
                  )}
                  {prescription.status === "preparing" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        statusMutation.mutate({ id: prescription.id, status: "ready" })
                      }
                      disabled={statusMutation.isPending && statusMutation.variables?.id === prescription.id}
                    >
                      <CheckCheck className="h-4 w-4" /> Đánh dấu sẵn sàng
                    </Button>
                  )}
                  {prescription.status === "ready" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        statusMutation.mutate({ id: prescription.id, status: "delivered" })
                      }
                      disabled={statusMutation.isPending && statusMutation.variables?.id === prescription.id}
                    >
                      <Send className="h-4 w-4" /> Đánh dấu đã bàn giao
                    </Button>
                  )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">Tổng tiền</p>
                    <p className="text-base font-semibold">{formatCurrency(total)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <Pagination
          page={paginated.page}
          pageCount={paginated.pageCount}
          total={paginated.total}
          onChange={paginated.setPage}
        />
      )}
    </div>
  );
}