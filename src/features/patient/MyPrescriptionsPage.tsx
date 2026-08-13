import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { PrescriptionStatusBadge } from "@/components/shared/StatusBadge";
import { getMyPrescriptions } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export function MyPrescriptionsPage() {
  const { profile } = useAuth();

  const { data: prescriptions = [], isLoading } = useQuery({
    queryKey: ["my-prescriptions", profile?.id],
    queryFn: () => getMyPrescriptions(profile!.id),
    enabled: !!profile,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Prescriptions"
        description="Track the status of your prescriptions in real time"
      />

      {isLoading ? (
        <ListSkeleton />
      ) : prescriptions.length === 0 ? (
        <EmptyState
          title="No prescriptions yet"
          description="Prescriptions from your doctor will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {prescriptions.map((prescription) => {
            const total = prescription.items.reduce(
              (sum, item) => sum + (item.medication?.price ?? 0) * item.quantity,
              0,
            );
            return (
              <Card key={prescription.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4 text-primary" />
                      Prescription
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        Dr. {prescription.doctor?.profile?.full_name ?? "Unknown"}
                      </Badge>
                      <PrescriptionStatusBadge status={prescription.status} />
                    </div>
                  </div>
                  <CardDescription>Issued {formatDateTime(prescription.created_at)}</CardDescription>
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
                        <span className="font-medium">
                          {formatCurrency((item.medication?.price ?? 0) * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex justify-end">
                    <span className="text-sm font-semibold">Total: {formatCurrency(total)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}