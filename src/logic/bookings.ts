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
