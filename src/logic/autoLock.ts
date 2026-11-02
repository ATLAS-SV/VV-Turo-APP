import { isInLot } from './geo';
import type { Booking, CarTelemetry, Settings } from './types';

export type AutoLockDecision =
  | { action: 'lock'; reason: string }
  | { action: 'none'; reason: string };

const MINUTE = 60_000;

/**
 * Decide whether a car should be auto-locked.
 *
 * Rules (from the planning doc):
 * - Only inside the home lot. Never anywhere else.
 * - Car must be unlocked and parked (engine off, not moving).
 * - It must have been parked for the set time. The timer starts from the later of
 *   "parked" and "last unlocked", so unlocking a car that's been parked all night
 *   (e.g. to clean it) doesn't get relocked a few seconds later.
 * - Cars with a guest countdown running are left to the guest countdown.
 */
export function evaluateAutoLock(
  t: CarTelemetry,
  settings: Settings,
  now: Date,
  bookingsForCar: Booking[] = [],
): AutoLockDecision {
  if (t.lockState !== 'unlocked') return { action: 'none', reason: 'Already locked' };
  if (!isInLot(t.position, settings.homeLot)) return { action: 'none', reason: 'Not in home lot' };
  if (t.engineOn || t.moving || !t.parkedSince) return { action: 'none', reason: 'Not parked' };
  if (bookingsForCar.some((b) => b.checkIn.state === 'unlocked' && !b.canceled)) {
    return { action: 'none', reason: 'Guest countdown running' };
  }

  const parkedAt = Date.parse(t.parkedSince);
  const unlockedAt = t.lastUnlockedAt ? Date.parse(t.lastUnlockedAt) : 0;
  const since = Math.max(parkedAt, unlockedAt);
  const waitMs = settings.autoLockParkedMinutes * MINUTE;
  if (now.getTime() - since < waitMs) {
    return { action: 'none', reason: 'Waiting for parked timer' };
  }
  return {
    action: 'lock',
    reason: `Parked unlocked in ${settings.homeLot.name} for ${settings.autoLockParkedMinutes}+ min`,
  };
}

/** Optional alert: car isn't back at the lot within N minutes of trip end. */
export function isLateReturn(
  booking: Booking,
  t: CarTelemetry | undefined,
  settings: Settings,
  now: Date,
): boolean {
  if (!settings.lateReturnAlertEnabled || booking.canceled || !t) return false;
  const deadline = Date.parse(booking.tripEnd) + settings.lateReturnAlertMinutes * MINUTE;
  if (now.getTime() < deadline) return false;
  // Only alert for recently-ended trips, so old history doesn't keep alerting.
  if (now.getTime() - deadline > 24 * 60 * MINUTE) return false;
  return !isInLot(t.position, settings.homeLot);
}
