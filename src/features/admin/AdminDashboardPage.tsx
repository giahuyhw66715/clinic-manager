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
        title="Tổng quan quản trị"
        description="Tổng quan phòng khám trong nháy mắt"
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Lịch hẹn hôm nay"
          value={todayAppointments.length}
          icon={CalendarDays}
          hint={`${consulted} hoàn tất`}
        />
        <StatCard
          title="Bệnh nhân đã đăng ký"
          value={patients}
          icon={Users}
        />
        <StatCard
          title="Đơn thuốc trong hàng đợi"
          value={inQueue}
          icon={Activity}
          hint={`${prescriptions.length} tổng cộng`}
        />
        <StatCard
          title="Tổng doanh thu"
          value={formatCurrency(revenue?.total ?? 0)}
          icon={DollarSign}
          hint={`${revenue?.paid ?? 0} đã thu`}
        />
        <StatCard
          title="Bác sĩ"
          value={doctors.length}
          icon={Stethoscope}
        />
        <StatCard
          title="Thuốc"
          value={medications.length}
          icon={Package}
          hint={`${lowStock} sắp hết`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" /> Tóm tắt lịch hẹn hôm nay
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              { label: "Chờ check-in", count: todayAppointments.filter((a) => ["pending", "confirmed"].includes(a.status)).length },
              { label: "Đã check-in / Đang khám", count: todayAppointments.filter((a) => ["checked-in", "in-progress"].includes(a.status)).length },
              { label: "Hoàn tất", count: consulted },
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
              <ShieldCheck className="h-4 w-4 text-primary" /> Phân bố vai trò
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