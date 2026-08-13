import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  Check,
  ClipboardList,
  HeartPulse,
  LogIn,
  Pill,
  Receipt,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: CalendarCheck,
    title: "Đặt lịch trực tuyến",
    description:
      "Bệnh nhân chọn khoa khám, bác sĩ và giờ hẹn với lịch trống cập nhật theo thời gian thực.",
  },
  {
    icon: ClipboardList,
    title: "Hồ sơ SOAP",
    description:
      "Bác sĩ ghi hồ sơ khám bệnh có cấu trúc và lưu giữ lịch sử khám đầy đủ của từng bệnh nhân.",
  },
  {
    icon: Pill,
    title: "Nhà thuốc kết nối",
    description:
      "Đơn thuốc được chuyển đến nhà thuốc ngay lập tức. Tồn kho được kiểm tra và trừ tự động.",
  },
  {
    icon: BellRing,
    title: "Thông báo thông minh",
    description:
      "Nhắc hẹn và cập nhật trạng thái giúp bệnh nhân, bác sĩ và nhân viên luôn đồng bộ trong suốt mỗi lần khám.",
  },
  {
    icon: Receipt,
    title: "Hóa đơn",
    description:
      "Phí khám và tiền thuốc được tổng hợp thành một hóa đơn duy nhất khi hoàn tất.",
  },
  {
    icon: ShieldCheck,
    title: "Phân quyền theo vai trò",
    description:
      "Trải nghiệm riêng cho bệnh nhân, bác sĩ, dược sĩ và quản trị viên với quyền truy cập an toàn.",
  },
];

const roles = [
  {
    icon: HeartPulse,
    title: "Dành cho Bệnh nhân",
    points: [
      "Đặt và đổi lịch chỉ với vài cú nhấp chuột",
      "Xem lịch sử khám bệnh của bạn tại một nơi",
      "Theo dõi đơn thuốc và hóa đơn",
    ],
  },
  {
    icon: Stethoscope,
    title: "Dành cho Bác sĩ",
    points: [
      "Quản lý danh sách khám trong ngày hiệu quả",
      "Ghi hồ sơ SOAP theo quy trình có hướng dẫn",
      "Chỉ kê thuốc còn hàng",
    ],
  },
  {
    icon: Pill,
    title: "Dành cho Dược sĩ",
    points: [
      "Đơn thuốc mới đến theo thời gian thực",
      "Chuẩn bị, đánh dấu sẵn sàng và cấp phát thuốc",
      "Kiểm soát tồn kho hiệu quả",
    ],
  },
];

const steps = [
  {
    step: "01",
    title: "Đặt lịch",
    description: "Bệnh nhân chọn khoa khám, bác sĩ và giờ trống chỉ trong vài giây.",
  },
  {
    step: "02",
    title: "Khám",
    description: "Bác sĩ tiếp nhận bệnh nhân, ghi hồ sơ và gửi đơn thuốc đến nhà thuốc.",
  },
  {
    step: "03",
    title: "Điều trị",
    description: "Dược sĩ cấp phát thuốc và hóa đơn được thanh toán tự động.",
  },
];

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Stethoscope className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">Quản lý Phòng khám</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/login">
                <LogIn className="h-4 w-4" /> Đăng nhập
              </Link>
            </Button>
            <Button asChild>
              <Link to="/register">
                Bắt đầu <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.12),transparent_55%)]"
          />
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Nền tảng quản lý phòng khám
            </Badge>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              Vận hành phòng khám của bạn từ{" "}
              <span className="bg-gradient-to-r from-primary to-sky-500 bg-clip-text text-transparent">
                một nơi
              </span>
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Bệnh nhân đặt lịch khám và theo dõi đơn thuốc theo thời gian thực. Bác sĩ ghi hồ
              sơ và gửi đơn thuốc trong vài giây. Dược sĩ chuẩn bị và cấp phát thuốc hiệu quả.
            </p>
            <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/register">
                  Đăng ký miễn phí <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Đăng nhập tài khoản</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Mượt mà cho bệnh nhân · bác sĩ · dược sĩ · quản trị viên
            </p>
          </div>

          {/* Stats */}
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-6 pb-20 sm:grid-cols-3">
            {[
              { value: "24/7", label: "Đặt lịch trực tuyến" },
              { value: "Real-time", label: "Nhà thuốc & thông báo" },
              { value: "4 roles", label: "Kiểm soát truy cập sẵn có" },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="text-left">
                    <p className="text-2xl font-extrabold tracking-tight text-primary">
                      {stat.value}
                    </p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="border-y bg-muted/40 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                Mọi thứ phòng khám cần
              </h2>
              <p className="mt-3 text-muted-foreground">
                Một hệ thống duy nhất kết nối mọi vai trò và luôn cập nhật thông tin cho bệnh
                nhân ở từng bước khám bệnh.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="transition-colors hover:border-primary/40">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{feature.title}</h3>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Cách hoạt động</h2>
              <p className="mt-3 text-muted-foreground">
                Từ đặt lịch đến cấp phát thuốc, toàn bộ quy trình được xử lý trong một hệ thống.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {steps.map((item) => (
                <div key={item.step} className="relative rounded-xl border bg-card p-6">
                  <span className="text-4xl font-extrabold text-primary/20">{item.step}</span>
                  <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="border-y bg-muted/40 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Dành cho mọi thành viên</h2>
              <p className="mt-3 text-muted-foreground">
                Trải nghiệm phù hợp cho mọi người trong phòng khám, từ quầy tiếp đón đến nhà
                thuốc.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {roles.map((role) => (
                <Card key={role.title}>
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <role.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold">{role.title}</h3>
                    <ul className="mt-4 space-y-2.5">
                      {role.points.map((point) => (
                        <li key={point} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <span className="text-muted-foreground">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-5xl px-6">
            <div className="rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground shadow-lg sm:px-12 sm:py-16">
              <Users className="mx-auto mb-4 h-10 w-10 opacity-80" />
              <h2 className="mx-auto max-w-xl text-3xl font-bold tracking-tight">
                Sẵn sàng hiện đại hóa phòng khám của bạn?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
                Tham gia Quản lý Phòng khám và tinh gọn việc đặt lịch, khám bệnh và vận hành
                nhà thuốc tại một nơi.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  asChild
                >
                  <Link to="/register">
                    Tạo tài khoản miễn phí <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
                  asChild
                >
                  <Link to="/login">Đăng nhập</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="font-semibold text-foreground">Quản lý Phòng khám</span>
          </div>
          <p>
            © {new Date().getFullYear()} Quản lý Phòng khám · Được hỗ trợ bởi{" "}
            <span className="font-medium text-foreground">Supabase</span>
          </p>
        </div>
      </footer>
    </div>
  );
}