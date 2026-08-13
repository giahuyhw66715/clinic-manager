import { useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Pill,
  Receipt,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { cn, initials } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Activity;
}

const navByRole: Record<string, NavItem[]> = {
  patient: [
    { to: "/app/appointments", label: "My Appointments", icon: CalendarDays },
    { to: "/app/history", label: "Medical History", icon: History },
    { to: "/app/prescriptions", label: "My Prescriptions", icon: FileText },
    { to: "/app/invoices", label: "Invoices", icon: Receipt },
  ],
  doctor: [
    { to: "/app/doctor/queue", label: "Appointments", icon: Activity },
    { to: "/app/doctor/patients", label: "My Patients", icon: Users },
    { to: "/app/doctor/schedule", label: "My Schedule", icon: CalendarDays },
  ],
  pharmacist: [
    { to: "/app/pharmacy/queue", label: "Prescription Queue", icon: Activity },
    { to: "/app/pharmacy/checkin", label: "Check-in", icon: UserRound },
    { to: "/app/pharmacy/inventory", label: "Inventory", icon: Package },
  ],
  admin: [
    { to: "/app/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/admin/users", label: "Users & Roles", icon: Users },
    { to: "/app/admin/doctors", label: "Doctors & Schedules", icon: Stethoscope },
    { to: "/app/admin/departments", label: "Departments", icon: ShieldCheck },
    { to: "/app/admin/medications", label: "Medications", icon: Pill },
  ],
};

const roleLabel: Record<string, string> = {
  patient: "Patient",
  doctor: "Doctor",
  pharmacist: "Pharmacist",
  admin: "Admin",
};

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const location = useLocation();
  const activeTo = items
    .filter(
      (item) => location.pathname === item.to || location.pathname.startsWith(item.to + "/"),
    )
    .sort((a, b) => b.to.length - a.to.length)[0]?.to;
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = activeTo === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!profile) return null;

  const navItems = navByRole[profile.role] ?? [];

  const sidebar = (
    <div className="flex h-full flex-col gap-6 py-5">
      <Link to="/app" className="flex items-center gap-2 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Stethoscope className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold">ClinicManager</span>
      </Link>
      <ScrollArea className="flex-1 px-3">
        <NavLinks items={navItems} />
      </ScrollArea>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-background lg:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full outline-none">
                  <Avatar>
                    <AvatarFallback>{initials(profile.full_name ?? "User")}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-1">
                    <span className="truncate">{profile.full_name ?? "User"}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {roleLabel[profile.role]}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}