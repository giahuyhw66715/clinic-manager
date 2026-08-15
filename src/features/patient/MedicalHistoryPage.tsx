import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { TimelineSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { getPatientMedicalRecords } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/utils";

const recordFields = [
  { key: "symptoms", label: "Triệu chứng" },
  { key: "diagnosis", label: "Chẩn đoán" },
  { key: "treatment_plan", label: "Kế hoạch điều trị" },
  { key: "notes", label: "Ghi chú" },
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
        title="Lịch sử khám bệnh"
        description="Hồ sơ khám bệnh của bạn qua các lần khám"
      />

      {isLoading ? (
        <TimelineSkeleton />
      ) : records.length === 0 ? (
        <EmptyState
          title="Chưa có hồ sơ khám nào"
          description="Ghi chú của bác sĩ sẽ hiển thị tại đây sau mỗi lần khám."
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
                        {record.diagnosis ?? "Buổi khám"}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {record.doctor?.profile?.full_name ?? "Bác sĩ"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(record.created_at)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-3">
                      {recordFields
                        .filter((f) => f.key !== "notes")
                        .map((field) => {
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
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Ghi chú
                        </dt>
                        <ExpandableText
                          text={record.notes}
                          emptyText="Không có ghi chú"
                          className="mt-1 text-sm"
                        />
                      </div>
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