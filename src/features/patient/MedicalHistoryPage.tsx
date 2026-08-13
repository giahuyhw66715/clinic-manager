import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { TimelineSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { getPatientMedicalRecords } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/utils";

const recordFields = [
  { key: "symptoms", label: "Symptoms" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "treatment_plan", label: "Treatment plan" },
  { key: "notes", label: "Notes" },
] as const;

export function MedicalHistoryPage() {
  const { profile } = useAuth();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["my-records", profile?.id],
    queryFn: () => getPatientMedicalRecords(profile!.id),
    enabled: !!profile,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medical History"
        description="Your clinical records across all visits"
      />

      {isLoading ? (
        <TimelineSkeleton />
      ) : records.length === 0 ? (
        <EmptyState
          title="No medical records yet"
          description="Your doctor's notes will appear here after your visits."
        />
      ) : (
        <div className="relative pl-6">
          <div className="absolute bottom-0 left-2 top-0 w-px bg-border" />
          <div className="space-y-6">
            {records.map((record) => (
              <div key={record.id} className="relative">
                <span className="absolute -left-[26px] top-2 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-background" />
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        {record.diagnosis ?? "Consultation"}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {record.doctor?.profile?.full_name ?? "Doctor"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(record.created_at)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-3">
                      {recordFields.map((field) => {
                        const value = record[field.key];
                        if (!value) return null;
                        return (
                          <div key={field.key}>
                            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {field.label}
                            </dt>
                            <dd className="mt-1 text-sm">{value}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}