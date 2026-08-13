import type { DoctorOffDay, DoctorSchedule } from "@/types";

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + (minutes ?? 0);
}

function toTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
}

export function isDateOff(offDays: DoctorOffDay[], date: Date): boolean {
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return offDays.some((off) => off.off_date === iso);
}

export function generateSlotsForDate(
  schedules: DoctorSchedule[],
  offDays: DoctorOffDay[],
  bookedSlots: string[],
  date: Date,
): string[] {
  if (isDateOff(offDays, date)) {
    return [];
  }

  const schedule = schedules.find((s) => s.day_of_week === date.getDay());
  if (!schedule) {
    return [];
  }

  const slots: string[] = [];
  const start = toMinutes(schedule.start_time);
  const end = toMinutes(schedule.end_time);
  const step = Math.max(schedule.slot_minutes, 10);

  for (let t = start; t + step <= end; t += step) {
    const slot = toTimeString(t);
    if (!bookedSlots.includes(slot)) {
      slots.push(slot);
    }
  }
  return slots;
}

export function generateAllSlotsForDate(
  schedules: DoctorSchedule[],
  offDays: DoctorOffDay[],
  date: Date,
): string[] {
  if (isDateOff(offDays, date)) return [];
  const schedule = schedules.find((s) => s.day_of_week === date.getDay());
  if (!schedule) return [];
  const slots: string[] = [];
  const step = Math.max(schedule.slot_minutes, 10);
  for (let t = toMinutes(schedule.start_time); t + step <= toMinutes(schedule.end_time); t += step) {
    slots.push(toTimeString(t));
  }
  return slots;
}