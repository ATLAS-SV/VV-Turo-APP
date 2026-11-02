// GENERATED from src/logic/guestCheckIn.ts by scripts/sync-server-logic.mjs. Edit the original, not this copy.
import { isInLot } from './geo.ts';
import type { Booking, CarTelemetry, LatLng, Settings } from './types.ts';

const MINUTE = 60_000;

/** Phone location must be at least this accurate to count as "in the lot". */
export const MAX_LOCATION_ACCURACY_M = 75;

export function pickupWindow(booking: Booking, settings: Settings) {
  const start = Date.parse(booking.tripStart);
  return {
    opensAt: new Date(start - settings.pickupWindowBeforeMinutes * MINUTE),
    closesAt: new Date(start + settings.pickupWindowAfterMinutes * MINUTE),
  };
}

/** The link stops working once the trip starts, the booking is canceled, or the window closes. */
export function isLinkExpired(booking: Booking, settings: Settings, now: Date): boolean {
  if (booking.canceled) return true;
  if (booking.checkIn.state === 'started' || booking.checkIn.state === 'expired') return true;
  return now.getTime() > pickupWindow(booking, settings).closesAt.getTime();
}

export type CheckInRefusal =
  | 'expired'
  | 'too_early'
  | 'location_inaccurate'
  | 'outside_lot'
  | 'car_not_in_lot'
  | 'already_unlocked'
  | 'no_retries_left';

export type CheckInDecision = { ok: true; isRetry: boolean } | { ok: false; reason: CheckInRefusal };

export const REFUSAL_MESSAGES: Record<CheckInRefusal, string> = {
  expired: 'This check-in link has expired.',
  too_early: 'Too early. The car unlocks when your pickup window opens.',
  location_inaccurate: "Your phone's location isn't accurate enough yet. Try again in a moment.",
  outside_lot: "You don't appear to be in the pickup lot yet.",
  car_not_in_lot: "Your car isn't showing in the lot. Please contact your host.",
  already_unlocked: 'Your car is already unlocked.',
  no_retries_left: 'No unlock retries left. Please contact your host through Turo.',
};

/**
 * Called when the guest's check-in page reports their location.
 * The first unlock is free; after that, "unlock again" is limited by settings.guestUnlockRetries.
 */
export function evaluateCheckIn(
  booking: Booking,
  guest: { position: LatLng; accuracyM: number },
  car: CarTelemetry | undefined,
  settings: Settings,
  now: Date,
): CheckInDecision {
  if (isLinkExpired(booking, settings, now)) return { ok: false, reason: 'expired' };
  if (now.getTime() < pickupWindow(booking, settings).opensAt.getTime()) {
    return { ok: false, reason: 'too_early' };
  }
  if (booking.checkIn.state === 'unlocked') return { ok: false, reason: 'already_unlocked' };
  if (guest.accuracyM > MAX_LOCATION_ACCURACY_M) return { ok: false, reason: 'location_inaccurate' };
  if (!isInLot(guest.position, settings.homeLot)) return { ok: false, reason: 'outside_lot' };
  if (!car || !isInLot(car.position, settings.homeLot)) return { ok: false, reason: 'car_not_in_lot' };

  const isRetry = booking.checkIn.unlockCount > 0;
  if (isRetry && booking.checkIn.unlockCount - 1 >= settings.guestUnlockRetries) {
    return { ok: false, reason: 'no_retries_left' };
  }
  return { ok: true, isRetry };
}

export function retriesLeft(booking: Booking, settings: Settings): number {
  if (booking.checkIn.unlockCount === 0) return settings.guestUnlockRetries;
  return Math.max(0, settings.guestUnlockRetries - (booking.checkIn.unlockCount - 1));
}

export type CountdownDecision = 'waiting' | 'relock' | 'started';

/** While a guest countdown runs: did the car drive off, or did time run out? */
export function evaluateCountdown(
  booking: Booking,
  car: CarTelemetry | undefined,
  settings: Settings,
  now: Date,
): CountdownDecision {
  if (booking.checkIn.state !== 'unlocked' || !booking.checkIn.lastUnlockAt) return 'waiting';
  if (car && (car.moving || car.engineOn)) return 'started';
  const endsAt = Date.parse(booking.checkIn.lastUnlockAt) + settings.guestCountdownMinutes * MINUTE;
  return now.getTime() >= endsAt ? 'relock' : 'waiting';
}

export function countdownEndsAt(booking: Booking, settings: Settings): Date | null {
  if (booking.checkIn.state !== 'unlocked' || !booking.checkIn.lastUnlockAt) return null;
  return new Date(Date.parse(booking.checkIn.lastUnlockAt) + settings.guestCountdownMinutes * MINUTE);
}
