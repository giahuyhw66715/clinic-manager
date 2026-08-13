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
    title: "Online booking",
    description:
      "Patients pick a department, doctor and time slot with live availability — updates in real time.",
  },
  {
    icon: ClipboardList,
    title: "SOAP records",
    description:
      "Doctors write structured consultation records and keep a complete visit history per patient.",
  },
  {
    icon: Pill,
    title: "Connected pharmacy",
    description:
      "Prescriptions flow to the pharmacy instantly. Stock is checked and decremented automatically.",
  },
  {
    icon: BellRing,
    title: "Smart notifications",
    description:
      "Reminders and status updates keep patients, doctors and staff in sync around every visit.",
  },
  {
    icon: Receipt,
    title: "Invoicing",
    description:
      "Consultation fees and medication totals are rolled into a single invoice at completion.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    description:
      "Dedicated experiences for patients, doctors, pharmacists and admins with secure permissions.",
  },
];

const roles = [
  {
    icon: HeartPulse,
    title: "For Patients",
    points: [
      "Book and reschedule in a few clicks",
      "See your medical history in one place",
      "Track prescriptions and invoices",
    ],
  },
  {
    icon: Stethoscope,
    title: "For Doctors",
    points: [
      "Manage today's queue efficiently",
      "Write SOAP notes on a guided flow",
      "Prescribe only medication in stock",
    ],
  },
  {
    icon: Pill,
    title: "For Pharmacists",
    points: [
      "New prescriptions arrive in real time",
      "Prepare, mark ready and dispense",
      "Keep inventory under control",
    ],
  },
];

const steps = [
  {
    step: "01",
    title: "Book",
    description: "Patients choose a department, doctor and a free time slot in seconds.",
  },
  {
    step: "02",
    title: "Consult",
    description: "Doctors check patients in, write records and send prescriptions to the pharmacy.",
  },
  {
    step: "03",
    title: "Treat",
    description: "Pharmacists dispense the medication and the invoice is settled automatically.",
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
            <span className="text-lg font-bold tracking-tight">ClinicManager</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/login">
                <LogIn className="h-4 w-4" /> Sign in
              </Link>
            </Button>
            <Button asChild>
              <Link to="/register">
                Get started <ArrowRight className="h-4 w-4" />
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
              Clinic management platform
            </Badge>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              Run your clinic from{" "}
              <span className="bg-gradient-to-r from-primary to-sky-500 bg-clip-text text-transparent">
                one place
              </span>
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Patients book appointments and track prescriptions in real time. Doctors write
              records and send prescriptions in seconds. Pharmacists prepare and dispense
              medication efficiently.
            </p>
            <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/register">
                  Get started for free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Sign in to your account</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Seamless for patients · doctors · pharmacists · admins
            </p>
          </div>

          {/* Stats */}
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-6 pb-20 sm:grid-cols-3">
            {[
              { value: "24/7", label: "Online booking" },
              { value: "Real-time", label: "Pharmacy & notifications" },
              { value: "4 roles", label: "Built-in access control" },
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
                Everything your clinic needs
              </h2>
              <p className="mt-3 text-muted-foreground">
                A single system that connects every role and keeps patients informed at every
                step of their visit.
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
              <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
              <p className="mt-3 text-muted-foreground">
                From booking to dispense, the whole journey is handled in one system.
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
              <h2 className="text-3xl font-bold tracking-tight">Built for every team member</h2>
              <p className="mt-3 text-muted-foreground">
                Tailored experiences for everyone in the clinic, from the front desk to the
                pharmacy.
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
                Ready to modernize your clinic?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
                Join ClinicManager and streamline booking, consultations and pharmacy operations
                in one place.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  asChild
                >
                  <Link to="/register">
                    Create a free account <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
                  asChild
                >
                  <Link to="/login">Sign in</Link>
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
            <span className="font-semibold text-foreground">ClinicManager</span>
          </div>
          <p>
            © {new Date().getFullYear()} ClinicManager · Powered by{" "}
            <span className="font-medium text-foreground">Supabase</span>
          </p>
        </div>
      </footer>
    </div>
  );
}