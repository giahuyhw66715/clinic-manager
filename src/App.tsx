import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/layout/AppLayout";
import { AppLayoutSkeleton } from "./components/shared/Skeletons";
import { useAuth } from "./contexts/AuthContext";
import type { UserRole } from "./types";
import { RoleHome } from "./features/home/RoleHome";
import { LandingPage } from "./features/home/LandingPage";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";

import { BookAppointmentPage } from "./features/booking/BookAppointmentPage";
import { MedicalHistoryPage } from "./features/patient/MedicalHistoryPage";
import { InvoicesPage } from "./features/patient/InvoicesPage";
import { MyAppointmentsPage } from "./features/patient/MyAppointmentsPage";
import { MyPrescriptionsPage } from "./features/patient/MyPrescriptionsPage";

import { DoctorQueuePage } from "./features/doctor/DoctorQueuePage";
import { MyPatientsPage } from "./features/doctor/MyPatientsPage";
import { MySchedulePage } from "./features/doctor/MySchedulePage";
import { PatientHistoryPage } from "./features/doctor/PatientHistoryPage";
import { PatientRecordPage } from "./features/doctor/PatientRecordPage";

import { CheckInPage } from "./features/pharmacist/CheckInPage";
import { InventoryPage } from "./features/pharmacist/InventoryPage";
import { PrescriptionDetailPage } from "./features/pharmacist/PrescriptionDetailPage";
import { PrescriptionQueuePage } from "./features/pharmacist/PrescriptionQueuePage";

import { AdminDashboardPage } from "./features/admin/AdminDashboardPage";
import { DepartmentsPage } from "./features/admin/DepartmentsPage";
import { DoctorsPage } from "./features/admin/DoctorsPage";
import { MedicationsPage } from "./features/admin/MedicationsPage";
import { UsersPage } from "./features/admin/UsersPage";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function RoleRoute({ allowed }: { allowed: UserRole[] }) {
  const { profile } = useAuth();
  if (!profile || !allowed.includes(profile.role)) {
    return <Navigate to="/app" replace />;
  }
  return <Outlet />;
}

function ProtectedRoutes() {
  const { user, profile, isLoading, profileLoading, signOut } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profileLoading) {
    return <AppLayoutSkeleton />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-lg font-semibold">Không tìm thấy hồ sơ</h1>
        <p className="text-sm text-muted-foreground">
          Tài khoản của bạn chưa có hồ sơ. Vui lòng liên hệ quản trị viên hoặc đăng xuất rồi thử
          lại.
        </p>
        <button
          type="button"
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => void signOut()}
        >
          Đăng xuất
        </button>
      </div>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route index element={<RoleHome />} />

        {/* Patient */}
        <Route element={<RoleRoute allowed={["patient"]} />}>
          <Route path="appointments" element={<MyAppointmentsPage />} />
          <Route path="history" element={<MedicalHistoryPage />} />
          <Route path="prescriptions" element={<MyPrescriptionsPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="book" element={<BookAppointmentPage />} />
        </Route>

        {/* Doctor */}
        <Route element={<RoleRoute allowed={["doctor"]} />}>
          <Route path="doctor/queue" element={<DoctorQueuePage />} />
          <Route path="doctor/patients" element={<MyPatientsPage />} />
          <Route path="doctor/schedule" element={<MySchedulePage />} />
          <Route path="doctor/patients/:patientId" element={<PatientHistoryPage />} />
          <Route path="doctor/appointments/:appointmentId" element={<PatientRecordPage />} />
        </Route>

        {/* Pharmacist */}
        <Route element={<RoleRoute allowed={["pharmacist"]} />}>
          <Route path="pharmacy/queue" element={<PrescriptionQueuePage />} />
          <Route path="pharmacy/checkin" element={<CheckInPage />} />
          <Route path="pharmacy/inventory" element={<InventoryPage />} />
          <Route path="pharmacy/prescriptions/:id" element={<PrescriptionDetailPage />} />
        </Route>

        {/* Admin */}
        <Route element={<RoleRoute allowed={["admin"]} />}>
          <Route path="admin" element={<AdminDashboardPage />} />
          <Route path="admin/users" element={<UsersPage />} />
          <Route path="admin/doctors" element={<DoctorsPage />} />
          <Route path="admin/departments" element={<DepartmentsPage />} />
          <Route path="admin/medications" element={<MedicationsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/app" replace /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/app" replace /> : <RegisterPage />} />
      <Route path="/app/*" element={<ProtectedRoutes />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}