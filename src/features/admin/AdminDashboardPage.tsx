import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  DollarSign,
  Package,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardSkeleton } from "@/components/shared/Skeletons";
import { StatCard } from "@/components/shared/StatCard";
import {
  getDoctors,
  getMedications,
  getPharmacyPrescriptions,
  getProfiles,
  getRevenueStats,
  getTodayAppointmentsForCheckIn,
} from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export function AdminDashboardPage() {
  const { data: todayAppointments = [], isLoading } = useQuery({
    queryKey: ["today-checkin"],
    queryFn: getTodayAppointmentsForCheckIn,
  });
  const { data: prescriptions = [] } = useQuery({
    queryKey: ["pharmacy-prescriptions"],
    queryFn: getPharmacyPrescriptions,
  });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: getProfiles });
  const { data: doctors = [] } = useQuery({ queryKey: ["doctors"], queryFn: getDoctors });
  const { data: medications = [] } = useQuery({
    queryKey: ["medications"],
    queryFn: getMedications,
  });
  const { data: revenue } = useQuery({ queryKey: ["revenue-stats"], queryFn: getRevenueStats });

  const patients = profiles.filter((p) => p.role === "patient").length;
  const lowStock = medications.filter((m) => m.stock_qty <= m.reorder_level).length;
  const inQueue = prescriptions.filter((p) => p.status === "sent" || p.status === "preparing").length;
  const consulted = todayAppointments.filter((a) => a.status === "completed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Clinic overview at a glance"
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Appointments today"
          value={todayAppointments.length}
          icon={CalendarDays}
          hint={`${consulted} completed`}
        />
        <StatCard
          title="Registered patients"
          value={patients}
          icon={Users}
        />
        <StatCard
          title="Prescriptions in queue"
          value={inQueue}
          icon={Activity}
          hint={`${prescriptions.length} total`}
        />
        <StatCard
          title="Total revenue"
          value={formatCurrency(revenue?.total ?? 0)}
          icon={DollarSign}
          hint={`${revenue?.paid ?? 0} collected`}
        />
        <StatCard
          title="Doctors"
          value={doctors.length}
          icon={Stethoscope}
        />
        <StatCard
          title="Medications"
          value={medications.length}
          icon={Package}
          hint={`${lowStock} low stock`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" /> Today's appointment summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              { label: "Awaiting check-in", count: todayAppointments.filter((a) => ["pending", "confirmed"].includes(a.status)).length },
              { label: "Checked in / in progress", count: todayAppointments.filter((a) => ["checked-in", "in-progress"].includes(a.status)).length },
              { label: "Completed", count: consulted },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-md border p-3">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-semibold">{row.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> Role distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(["patient", "doctor", "pharmacist", "admin"] as const).map((role) => {
              const count = profiles.filter((p) => p.role === role).length;
              const pct = profiles.length ? Math.round((count / profiles.length) * 100) : 0;
              return (
                <div key={role} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground capitalize">{role}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}