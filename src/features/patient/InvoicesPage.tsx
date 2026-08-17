import { useQuery } from "@tanstack/react-query";
import { Document, Page, Text, View, StyleSheet, pdf, Font } from "@react-pdf/renderer";
import { toast } from "sonner";
import { Download, Receipt } from "lucide-react";

import RobotoRegular from "@/assets/fonts/Roboto-Regular.ttf";
import RobotoBold from "@/assets/fonts/Roboto-Bold.ttf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import { PageHeader } from "@/components/shared/PageHeader";
import { getMyInvoices } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDateTime, formatTime } from "@/lib/utils";
import type { Invoice } from "@/types";

Font.register({
  family: "Roboto",
  fonts: [
    { src: RobotoRegular, fontWeight: "normal" },
    { src: RobotoBold, fontWeight: "bold" },
  ],
});

const pdfStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 12, color: "#0f172a", fontFamily: "Roboto" },
  header: { marginBottom: 24 },
  clinicName: { fontSize: 18, fontWeight: "bold" },
  subtitle: { color: "#64748b", marginTop: 4 },
  divider: { borderBottom: "1px solid #e2e8f0", marginVertical: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { color: "#64748b" },
  total: { fontSize: 14, fontWeight: "bold" },
  sectionTitle: { fontWeight: "bold", marginBottom: 8, marginTop: 12 },
});

function InvoicePdf({ invoice }: { invoice: Invoice }) {
  const appointment = invoice.appointment;
  const consultationFee = appointment?.doctor?.consultation_fee ?? 0;
  const medicationTotal = Math.max(0, invoice.total_amount - consultationFee);

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.clinicName}>Quản lý Phòng khám</Text>
          <Text style={pdfStyles.subtitle}>Hóa đơn phòng khám</Text>
        </View>
        <View style={pdfStyles.divider} />
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Hóa đơn #{invoice.id.slice(0, 8)}</Text>
          <Text>{formatDateTime(invoice.created_at)}</Text>
        </View>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Bệnh nhân</Text>
          <Text>{invoice.patient?.full_name ?? "—"}</Text>
        </View>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Bác sĩ</Text>
          <Text>BS. {appointment?.doctor?.profile?.full_name ?? "—"}</Text>
        </View>
        {appointment && (
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Lịch hẹn</Text>
            <Text>
              {appointment.appointment_date} lúc {formatTime(appointment.time_slot)}
            </Text>
          </View>
        )}
        <View style={pdfStyles.divider} />
        <Text style={pdfStyles.sectionTitle}>Chi tiết</Text>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Phí khám</Text>
          <Text>{formatCurrency(consultationFee)}</Text>
        </View>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Thuốc</Text>
          <Text>{formatCurrency(medicationTotal)}</Text>
        </View>
        <View style={pdfStyles.divider} />
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.total}>Tổng cộng</Text>
          <Text style={pdfStyles.total}>{formatCurrency(invoice.total_amount)}</Text>
        </View>
        <View style={[pdfStyles.row, { marginTop: 12 }]}>
          <Text style={{ fontWeight: "bold" }}>
            {invoice.paid ? "ĐÃ THANH TOÁN" : "CHƯA THANH TOÁN"}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

async function downloadInvoice(invoice: Invoice) {
  try {
    const blob = await pdf(<InvoicePdf invoice={invoice} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoice-${invoice.id.slice(0, 8)}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    toast.error((error as Error).message);
  }
}

export function InvoicesPage() {
  const { profile } = useAuth();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["my-invoices", profile?.id],
    queryFn: () => getMyInvoices(profile!.id),
    enabled: !!profile,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Hóa đơn" description="Hóa đơn khám bệnh và thuốc của bạn" />

      {isLoading ? (
        <CardGridSkeleton className="md:grid-cols-1" />
      ) : invoices.length === 0 ? (
        <EmptyState
          title="Chưa có hóa đơn nào"
          description="Hóa đơn được tạo sau khi hoàn tất khám bệnh."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {invoices.map((invoice) => (
            <Card key={invoice.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Receipt className="h-4 w-4 text-primary" />
                    {invoice.appointment?.doctor?.profile
                      ? `BS. ${invoice.appointment.doctor.profile.full_name}`
                      : "Hóa đơn"}
                  </CardTitle>
                  <Badge variant={invoice.paid ? "success" : "warning"}>
                    {invoice.paid ? "Đã thanh toán" : "Chưa thanh toán"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  {invoice.appointment?.appointment_date ?? "—"} lúc{" "}
                  {invoice.appointment ? formatTime(invoice.appointment.time_slot) : "—"}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tổng cộng</span>
                  <span className="text-lg font-bold">{formatCurrency(invoice.total_amount)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => void downloadInvoice(invoice)}
                >
                  <Download className="h-4 w-4" /> Tải PDF
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}