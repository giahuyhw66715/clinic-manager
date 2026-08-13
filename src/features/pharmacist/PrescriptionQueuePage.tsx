import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCheck, ClipboardList, PackageCheck, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination, usePagination } from "@/components/shared/Pagination";
import { PrescriptionStatusBadge } from "@/components/shared/StatusBadge";
import { getPharmacyPrescriptions, updatePrescriptionStatus } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/utils";
import type { PrescriptionStatus } from "@/types";

const statusTabs: { value: PrescriptionStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "delivered", label: "Delivered" },
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
      toast.success("Prescription updated");
      queryClient.invalidateQueries({ queryKey: ["pharmacy-prescriptions"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prescription Queue"
        description="New prescription from doctors arrive here in real time"
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
          title={tab === "all" ? "No prescriptions yet" : `No ${tab} prescriptions`}
          description="Prescriptions will appear here as soon as doctors send them."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {paginated.items.map((prescription) => (
            <Card key={prescription.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{prescription.patient?.full_name ?? "Patient"}</span>
                    </CardTitle>
                    <CardDescription>
                      {prescription.doctor?.profile?.full_name ?? "Unknown"} ·{" "}
                      {formatDateTime(prescription.created_at)}
                    </CardDescription>
                  </div>
                  <PrescriptionStatusBadge status={prescription.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1.5">
                  {prescription.items.slice(0, 4).map((item) => (
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
                  {prescription.items.length > 4 && (
                    <li className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      +{prescription.items.length - 4} more item
                      {prescription.items.length - 4 > 1 ? "s" : ""}
                    </li>
                  )}
                </ul>

                {prescription.notes && (
                  <p className="line-clamp-2 rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    {prescription.notes}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {prescription.status === "sent" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        statusMutation.mutate({ id: prescription.id, status: "preparing" })
                      }
                      disabled={statusMutation.isPending}
                    >
                      <PackageCheck className="h-4 w-4" /> Start preparing
                    </Button>
                  )}
                  {prescription.status === "preparing" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        statusMutation.mutate({ id: prescription.id, status: "ready" })
                      }
                      disabled={statusMutation.isPending}
                    >
                      <CheckCheck className="h-4 w-4" /> Mark ready
                    </Button>
                  )}
                  {prescription.status === "ready" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        statusMutation.mutate({ id: prescription.id, status: "delivered" })
                      }
                      disabled={statusMutation.isPending}
                    >
                      <Send className="h-4 w-4" /> Mark delivered
                    </Button>
                  )}
                  {prescription.status === "delivered" && (
                    <Badge variant="success">Handed to patient</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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