import { useQuery } from "@tanstack/react-query";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { toast } from "sonner";
import { Download, Receipt } from "lucide-react";

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

const pdfStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 12, color: "#0f172a" },
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
          <Text style={pdfStyles.clinicName}>ClinicManager</Text>
          <Text style={pdfStyles.subtitle}>Clinic Invoice</Text>
        </View>
        <View style={pdfStyles.divider} />
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Invoice #{invoice.id.slice(0, 8)}</Text>
          <Text>{formatDateTime(invoice.created_at)}</Text>
        </View>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Patient</Text>
          <Text>{invoice.patient?.full_name ?? "—"}</Text>
        </View>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Doctor</Text>
          <Text>Dr. {appointment?.doctor?.profile?.full_name ?? "—"}</Text>
        </View>
        {appointment && (
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Appointment</Text>
            <Text>
              {appointment.appointment_date} at {formatTime(appointment.time_slot)}
            </Text>
          </View>
        )}
        <View style={pdfStyles.divider} />
        <Text style={pdfStyles.sectionTitle}>Breakdown</Text>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Consultation fee</Text>
          <Text>{formatCurrency(consultationFee)}</Text>
        </View>
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.label}>Medication</Text>
          <Text>{formatCurrency(medicationTotal)}</Text>
        </View>
        <View style={pdfStyles.divider} />
        <View style={pdfStyles.row}>
          <Text style={pdfStyles.total}>Total</Text>
          <Text style={pdfStyles.total}>{formatCurrency(invoice.total_amount)}</Text>
        </View>
        <View style={[pdfStyles.row, { marginTop: 12 }]}>
          <Text style={{ fontWeight: "bold" }}>
            {invoice.paid ? "PAID" : "UNPAID"}
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
      <PageHeader title="Invoices" description="Your visit and medication invoices" />

      {isLoading ? (
        <CardGridSkeleton className="md:grid-cols-1" />
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Invoices are generated after completed visits."
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
                      ? `Dr. ${invoice.appointment.doctor.profile.full_name}`
                      : "Invoice"}
                  </CardTitle>
                  <Badge variant={invoice.paid ? "success" : "warning"}>
                    {invoice.paid ? "Paid" : "Unpaid"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  {invoice.appointment?.appointment_date ?? "—"} at{" "}
                  {invoice.appointment ? formatTime(invoice.appointment.time_slot) : "—"}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-lg font-bold">{formatCurrency(invoice.total_amount)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => void downloadInvoice(invoice)}
                >
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}