// GENERATED from src/logic/automation.ts by scripts/sync-server-logic.mjs. Edit the original, not this copy.
import { evaluateAutoLock, isLateReturn } from './autoLock.ts';
import { evaluateCountdown, isLinkExpired } from './guestCheckIn.ts';
import type { Booking, Car, CarTelemetry, Settings } from './types.ts';

export type AutomationAction =
  | { type: 'auto_lock'; carId: string; reason: string }
  | { type: 'guest_relock'; bookingId: string; carId: string }
  | { type: 'trip_started'; bookingId: string; carId: string }
  | { type: 'expire_link'; bookingId: string }
  | { type: 'late_return'; bookingId: string; carId: string };

/**
 * One pass of the automation loop. Pure: given the current state, return what should happen.
 * Today this runs in the app while it's open. For real overnight auto-locking it must run on a
 * server on a schedule — this function is written so it can move there unchanged.
 */
export function planAutomation(input: {
  cars: Car[];
  telemetry: Record<string, CarTelemetry>;
  bookings: Booking[];
  settings: Settings;
  lateAlertsSent: string[];
  now: Date;
}): AutomationAction[] {
  const { cars, telemetry, bookings, settings, lateAlertsSent, now } = input;
  const actions: AutomationAction[] = [];
  const relocking = new Set<string>();

  for (const b of bookings) {
    const t = telemetry[b.carId];
    if (b.checkIn.state === 'unlocked') {
      const d = evaluateCountdown(b, t, settings, now);
      if (d === 'started') actions.push({ type: 'trip_started', bookingId: b.id, carId: b.carId });
      if (d === 'relock') {
        actions.push({ type: 'guest_relock', bookingId: b.id, carId: b.carId });
        relocking.add(b.carId);
      }
    } else if (
      (b.checkIn.state === 'waiting' || b.checkIn.state === 'relocked') &&
      isLinkExpired(b, settings, now)
    ) {
      actions.push({ type: 'expire_link', bookingId: b.id });
    }
    if (!lateAlertsSent.includes(b.id) && isLateReturn(b, t, settings, now)) {
      actions.push({ type: 'late_return', bookingId: b.id, carId: b.carId });
    }
  }

  for (const car of cars) {
    const t = telemetry[car.id];
    if (!t || relocking.has(car.id)) continue;
    const d = evaluateAutoLock(
      t,
      settings,
      now,
      bookings.filter((b) => b.carId === car.id),
    );
    if (d.action === 'lock') actions.push({ type: 'auto_lock', carId: car.id, reason: d.reason });
  }
  return actions;
}
