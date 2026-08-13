import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { getDoctorByUserId, getDoctorAppointments } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { initials, cn } from "@/lib/utils";

export function MyPatientsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: doctor } = useQuery({
    queryKey: ["my-doctor", user?.id],
    queryFn: () => getDoctorByUserId(user!.id),
    enabled: !!user,
  });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["doctor-appointments", doctor?.id],
    queryFn: () => getDoctorAppointments(doctor!.id),
    enabled: !!doctor,
  });

  const patients = useMemo(() => {
    const map = new Map<string, { id: string; full_name: string; phone: string | null; last_visit: string }>();
    for (const appointment of appointments) {
      if (!appointment.patient) continue;
      const existing = map.get(appointment.patient.id);
      if (!existing || appointment.appointment_date > existing.last_visit) {
        map.set(appointment.patient.id, {
          id: appointment.patient.id,
          full_name: appointment.patient.full_name ?? "Unknown",
          phone: appointment.patient.phone,
          last_visit: appointment.appointment_date,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.last_visit.localeCompare(a.last_visit));
  }, [appointments]);

  const filtered = patients.filter(
    (p) =>
      !search ||
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="My Patients" description="Patients you have consulted" />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by name or phone..."
        className="max-w-sm"
      />

      {isLoading ? (
        <CardGridSkeleton className="sm:grid-cols-2 lg:grid-cols-3" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? "No matching patients" : "No patients yet"}
          description={
            search
              ? "Try a different search term."
              : "Once you consult patients, they will appear here."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((patient) => (
            <Card key={patient.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary",
                    )}
                  >
                    {initials(patient.full_name)}
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{patient.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {patient.phone ?? "No phone"} · Last visit{" "}
                      {patient.last_visit}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <UserRound className="h-3 w-3" /> Patient
                </span>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/app/doctor/patients/${patient.id}`}>
                    View records <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}