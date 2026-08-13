import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus, PrescriptionStatus } from "@/types";

const appointmentStatusConfig: Record<AppointmentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }> = {
  pending: { label: "Chờ xác nhận", variant: "warning" },
  confirmed: { label: "Đã xác nhận", variant: "info" },
  "checked-in": { label: "Đã đến", variant: "secondary" },
  "in-progress": { label: "Đang khám", variant: "default" },
  completed: { label: "Hoàn tất", variant: "success" },
  cancelled: { label: "Đã hủy", variant: "destructive" },
  "no-show": { label: "Vắng mặt", variant: "destructive" },
};

const prescriptionStatusConfig: Record<PrescriptionStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }> = {
  sent: { label: "Đã gửi", variant: "warning" },
  preparing: { label: "Đang chuẩn bị", variant: "info" },
  ready: { label: "Sẵn sàng", variant: "success" },
  delivered: { label: "Đã bàn giao", variant: "default" },
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const config = appointmentStatusConfig[status];
  return <Badge variant={config.variant} className="shrink-0 whitespace-nowrap">{config.label}</Badge>;
}

export function PrescriptionStatusBadge({ status }: { status: PrescriptionStatus }) {
  const config = prescriptionStatusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}