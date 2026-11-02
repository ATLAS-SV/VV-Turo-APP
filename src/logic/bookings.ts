import type { Booking, BookingStatus } from './types';

export function bookingStatus(b: Booking, now: Date): BookingStatus {
  if (b.canceled) return 'canceled';
  const t = now.getTime();
  if (t < Date.parse(b.tripStart) && b.checkIn.state !== 'started') return 'upcoming';
  if (t <= Date.parse(b.tripEnd)) return 'active';
  return 'completed';
}

export function nextBookingForCar(bookings: Booking[], carId: string, now: Date): Booking | undefined {
  return bookings
    .filter((b) => b.carId === carId && !b.canceled && Date.parse(b.tripEnd) >= now.getTime())
    .sort((a, b) => Date.parse(a.tripStart) - Date.parse(b.tripStart))[0];
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Bookings whose trip starts on the given local day (cars going out that day), earliest first. */
export function pickupsOn(bookings: Booking[], day: Date): Booking[] {
  return bookings
    .filter((b) => !b.canceled && sameLocalDay(new Date(b.tripStart), day))
    .sort((a, b) => Date.parse(a.tripStart) - Date.parse(b.tripStart));
}

/** Bookings whose trip ends on the given local day (cars coming back that day). */
export function returnsOn(bookings: Booking[], day: Date): Booking[] {
  return bookings
    .filter((b) => !b.canceled && sameLocalDay(new Date(b.tripEnd), day))
    .sort((a, b) => Date.parse(a.tripEnd) - Date.parse(b.tripEnd));
}

export function tomorrow(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
}

/** Bookings that overlap the given local day (car is out or being picked up / returned that day). */
export function bookingsOnDay(bookings: Booking[], day: Date): Booking[] {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const end = start + 24 * 3600_000;
  return bookings
    .filter((b) => !b.canceled && Date.parse(b.tripStart) < end && Date.parse(b.tripEnd) >= start)
    .sort((a, b) => Date.parse(a.tripStart) - Date.parse(b.tripStart));
}

/** Calendar weeks (Sunday first) for a "YYYY-MM" month; days outside the month are null. */
export function monthGrid(ym: string): (Date | null)[][] {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (Date | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m - 1, d));
  while (cells.length % 7) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
