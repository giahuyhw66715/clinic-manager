import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus, PrescriptionStatus } from "@/types";

const appointmentStatusConfig: Record<AppointmentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }> = {
  pending: { label: "Pending", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "info" },
  "checked-in": { label: "Checked in", variant: "secondary" },
  "in-progress": { label: "In progress", variant: "default" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  "no-show": { label: "No-show", variant: "destructive" },
};

const prescriptionStatusConfig: Record<PrescriptionStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }> = {
  sent: { label: "Sent", variant: "warning" },
  preparing: { label: "Preparing", variant: "info" },
  ready: { label: "Ready", variant: "success" },
  delivered: { label: "Delivered", variant: "default" },
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const config = appointmentStatusConfig[status];
  return <Badge variant={config.variant} className="shrink-0 whitespace-nowrap">{config.label}</Badge>;
}

export function PrescriptionStatusBadge({ status }: { status: PrescriptionStatus }) {
  const config = prescriptionStatusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}