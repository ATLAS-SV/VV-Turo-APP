// GENERATED from src/logic/hours.ts by scripts/sync-server-logic.mjs. Edit the original, not this copy.
import type { Shift } from './types.ts';

export function shiftMinutes(shift: Shift, now: Date): number {
  const end = shift.clockOut ? Date.parse(shift.clockOut) : now.getTime();
  return Math.max(0, Math.round((end - Date.parse(shift.clockIn)) / 60_000));
}

/** Monday 00:00 local time of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}

/** Minutes worked between `from` and `to`, clipping shifts that cross the boundaries. */
export function minutesInRange(shifts: Shift[], from: Date, to: Date, now: Date): number {
  let total = 0;
  for (const s of shifts) {
    const start = Math.max(Date.parse(s.clockIn), from.getTime());
    const end = Math.min(s.clockOut ? Date.parse(s.clockOut) : now.getTime(), to.getTime());
    if (end > start) total += (end - start) / 60_000;
  }
  return Math.round(total);
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

export function openShift(shifts: Shift[], userId: string): Shift | undefined {
  return shifts.find((s) => s.userId === userId && !s.clockOut);
}
