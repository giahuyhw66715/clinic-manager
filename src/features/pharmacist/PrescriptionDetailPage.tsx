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
    onSuccess: () => {
      toast.success("Prescription updated");
      queryClient.invalidateQueries({ queryKey: ["prescription", id] });
      queryClient.invalidateQueries({ queryKey: ["pharmacy-prescriptions"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <DetailSkeleton />;
  if (!prescription) {
    return (
      <EmptyState title="Not found" description="This prescription does not exist." />
    );
  }

  const total = prescription.items.reduce(
    (sum, item) => sum + (item.medication?.price ?? 0) * item.quantity,
    0,
  );

  const nextAction: { status: PrescriptionStatus; label: string; icon: typeof Send } | null =
    prescription.status === "sent"
      ? { status: "preparing", label: "Start preparing", icon: PackageCheck }
      : prescription.status === "preparing"
        ? { status: "ready", label: "Mark ready", icon: CheckCheck }
        : prescription.status === "ready"
          ? { status: "delivered", label: "Mark delivered", icon: Send }
          : null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/app/pharmacy/queue">
          <ArrowLeft className="h-4 w-4" /> Back to queue
        </Link>
      </Button>

      <PageHeader
        title="Prescription"
        description={`Issued ${formatDateTime(prescription.created_at)}`}
      >
        <PrescriptionStatusBadge status={prescription.status} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Patient</CardTitle>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {nextAction ? (
                <Button
                  className="w-full"
                  onClick={() => statusMutation.mutate({ id: prescription.id, status: nextAction.status })}
                  disabled={statusMutation.isPending}
                >
                  <nextAction.icon className="h-4 w-4" /> {nextAction.label}
                </Button>
              ) : (
                <Badge variant="success" className="w-full justify-center">
                  Completed
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Medication lines</CardTitle>
            <CardDescription>
              Stock is deducted automatically when the prescription was sent.
            </CardDescription>
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
                      Qty {item.quantity}
                      {item.instructions ? ` · ${item.instructions}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency((item.medication?.price ?? 0) * item.quantity)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Stock left: {item.medication?.stock_qty ?? "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <span className="text-sm font-semibold">Total: {formatCurrency(total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}