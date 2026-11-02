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
