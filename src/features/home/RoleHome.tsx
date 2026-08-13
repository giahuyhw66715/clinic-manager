import { Link, Navigate } from "react-router-dom";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

const homeByRole: Record<string, string> = {
  patient: "/app/appointments",
  doctor: "/app/doctor/queue",
  pharmacist: "/app/pharmacy/queue",
  admin: "/app/admin",
};

export function RoleHome() {
  const { profile } = useAuth();

  if (!profile) return null;

  const home = homeByRole[profile.role];
  if (home) {
    return <Navigate to={home} replace />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chào mừng</CardTitle>
        <CardDescription>
          Tài khoản của bạn cần có vai trò hợp lệ. <Link to="/login" className="underline">Đăng nhập lại</Link>.
        </CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}