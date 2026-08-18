import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, Stethoscope } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ExpandableText } from "@/components/shared/ExpandableText";
import {
  getPatientAllergies,
  getPatientMedicalRecords,
  getPatientPrescriptions,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { formatDateTime, toDateKey } from "@/lib/utils";
import type { Profile } from "@/types";

export function PatientHistoryPage() {
  const { patientId } = useParams<{ patientId: string }>();

  const { data: patientProfile } = useQuery({
    queryKey: ["patient-profile", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", patientId!)
        .maybeSingle();
      return (data ?? null) as Profile | null;
    },
    enabled: !!patientId,
  });

  const { data: records = [] } = useQuery({
    queryKey: ["patient-records", patientId],
    queryFn: () => getPatientMedicalRecords(patientId!),
    enabled: !!patientId,
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ["patient-prescriptions", patientId],
    queryFn: () => getPatientPrescriptions(patientId!),
    enabled: !!patientId,
  });

  const { data: allergies = [] } = useQuery({
    queryKey: ["patient-allergies", patientId],
    queryFn: () => getPatientAllergies(patientId!),
    enabled: !!patientId,
  });

  const medsForRecord = (record: (typeof records)[number]) => {
    let matching = prescriptions.filter((p) => p.appointment_id === record.appointment_id);
    if (record.appointment_id === null) {
      const recordDay = toDateKey(new Date(record.created_at));
      matching = prescriptions.filter(
        (p) => p.appointment_id === null && toDateKey(new Date(p.created_at)) === recordDay,
      );
    }
    return matching.flatMap((p) => p.items);
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/app/doctor/patients">
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách bệnh nhân
        </Link>
      </Button>

      <PageHeader
        title={patientProfile?.full_name ?? "Bệnh nhân"}
        description={patientProfile?.phone ?? "Hồ sơ bệnh nhân"}
      />

      {patientProfile?.allergies && (
        <Alert variant="destructive">
          <Stethoscope className="h-4 w-4" />
          <AlertTitle>Dị ứng đã biết</AlertTitle>
          <AlertDescription>{patientProfile.allergies}</AlertDescription>
        </Alert>
      )}
      {allergies.length > 0 && (
        <Alert variant="destructive">
          <Stethoscope className="h-4 w-4" />
          <AlertTitle>Dị ứng thuốc đã ghi nhận</AlertTitle>
          <AlertDescription>
            {allergies.map((a) => a.medication?.name ?? a.allergen).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {records.length === 0 ? (
        <EmptyState title="Không có hồ sơ khám" description="Chưa có hồ sơ khám cho bệnh nhân này." />
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const meds = medsForRecord(record);
            return (
              <Card key={record.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ClipboardList className="h-4 w-4 text-primary" />
                      Hồ sơ khám
                    </CardTitle>
                    <Badge variant="secondary">
                      {record.doctor?.profile?.full_name ?? "—"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(record.created_at)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Chẩn đoán</dt>
                      <dd>
                        <ExpandableText text={record.diagnosis} emptyText="Không có chẩn đoán" />
                      </dd>
                    </div>
                    {record.symptoms && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Triệu chứng</dt>
                        <dd>
                          <ExpandableText text={record.symptoms} emptyText="Không có triệu chứng" />
                        </dd>
                      </div>
                    )}
                    {record.treatment_plan && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Kế hoạch điều trị</dt>
                        <dd>
                          <ExpandableText
                            text={record.treatment_plan}
                            emptyText="Không có kế hoạch điều trị"
                          />
                        </dd>
                      </div>
                    )}
                    {record.notes && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Ghi chú</dt>
                        <dd>
                          <ExpandableText text={record.notes} emptyText="Không có ghi chú" />
                        </dd>
                      </div>
                    )}
                    {meds.length > 0 && (
                      <div className="pt-1">
                        <dt className="text-xs text-muted-foreground">Thuốc đã cho</dt>
                        <dd>
                          <ul className="space-y-0.5">
                            {meds.map((item) => (
                              <li key={item.id}>
                                {item.medication?.name ?? "Thuốc"} × {item.quantity}
                                {item.dosage ? ` · ${item.dosage}` : ""}
                                {item.instructions ? ` · ${item.instructions}` : ""}
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}