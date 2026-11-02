// Shared data shapes. These are plain data so the same logic can later run on a server.

export type Role = 'executive' | 'employee';

export interface User {
  id: string;
  name: string;
  role: Role;
  pinHash: string;
  pinSalt: string;
  /** Cars this person may unlock when employee unlock scope is "assigned". */
  assignedCarIds: string[];
  /** Page the app opens to after this person enters their PIN. */
  homePage?: HomePage;
  createdAt: string;
}

export type HomePage = 'cars' | 'map' | 'bookings' | 'money' | 'hours';

export function defaultHomePage(role: Role): HomePage {
  return role === 'executive' ? 'cars' : 'hours';
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Geofence {
  name: string;
  address: string;
  /** Lot boundary, drawn as a polygon (at least 3 points). */
  polygon: LatLng[];
}

export interface Car {
  id: string;
  year: number | null;
  make: string;
  model: string;
  color?: string;
  plate?: string;
  /** Filled in once the car is connected to Smartcar. */
  smartcarVehicleId?: string;
  /** Filled in once a Zubie device is plugged in. */
  zubieDeviceId?: string;
}

export type LockState = 'locked' | 'unlocked' | 'unknown';

/** Latest known state of a car: location from Zubie, lock state from Smartcar. */
export interface CarTelemetry {
  carId: string;
  position: LatLng;
  engineOn: boolean;
  moving: boolean;
  /** When the car last stopped (engine off). null while driving. */
  parkedSince: string | null;
  lockState: LockState;
  /** When the car was last unlocked (by anyone). Auto-lock timing starts from the later of this and parkedSince. */
  lastUnlockedAt: string | null;
  updatedAt: string;
}

export interface Trip {
  id: string;
  carId: string;
  departedAt: string;
  arrivedAt: string | null;
  distanceMi: number;
  fromLabel: string;
  toLabel: string;
  stops: number;
}

export type BookingStatus = 'upcoming' | 'active' | 'completed' | 'canceled';

export type CheckInState =
  | 'waiting' // link sent, guest hasn't unlocked yet
  | 'unlocked' // guest unlocked, countdown running
  | 'relocked' // countdown ran out, car relocked
  | 'started' // car drove off: trip started, link expired
  | 'expired'; // pickup window closed or booking canceled

export interface Booking {
  id: string;
  reservationId: string;
  carId: string;
  guestFirstName: string;
  guestPhone?: string;
  tripStart: string;
  tripEnd: string;
  earnings: number;
  canceled: boolean;
  checkInToken: string;
  /** Link to this trip's Turo message thread (from Turo's emails). */
  turoConversationUrl?: string;
  /** When the check-in message was sent in Turo. */
  linkSentAt?: string | null;
  checkIn: {
    state: CheckInState;
    /** Number of successful guest unlocks so far (first unlock + retries). */
    unlockCount: number;
    lastUnlockAt: string | null;
  };
}

export type EarningType = 'trip' | 'incentive' | 'reimbursement' | 'claim';

/** A money line, like a row on Turo's earnings page. */
export interface EarningItem {
  id: string;
  type: EarningType;
  amount: number;
  /** When it counts: trip end date for trip earnings. */
  date: string;
  carId?: string;
  reservationId?: string;
  description: string;
  source: 'booking' | 'turo_email' | 'pretend';
}

/** A payment Turo sent to the bank (from Turo's payout emails). */
export interface Payout {
  id: string;
  sentAt: string;
  amount: number;
  method: string;
  source: 'turo_email' | 'pretend';
}

export type ActivityAction =
  | 'lock'
  | 'unlock'
  | 'auto_lock'
  | 'guest_unlock'
  | 'guest_relock'
  | 'guest_failed'
  | 'trip_started'
  | 'link_sent'
  | 'late_return'
  | 'clock_in'
  | 'clock_out'
  | 'pin_lockout'
  | 'settings_changed'
  | 'team_changed';

export type Actor =
  | { kind: 'user'; userId: string; name: string }
  | { kind: 'guest'; bookingId: string; name: string }
  | { kind: 'system' };

export interface ActivityEntry {
  id: string;
  at: string;
  action: ActivityAction;
  actor: Actor;
  carId?: string;
  detail?: string;
  /** Whether the owner gets a notification for this entry. */
  notify: boolean;
}

export interface Shift {
  id: string;
  userId: string;
  clockIn: string;
  clockOut: string | null;
}

export interface Settings {
  autoLockParkedMinutes: number;
  guestCountdownMinutes: number;
  pickupWindowBeforeMinutes: number;
  pickupWindowAfterMinutes: number;
  guestUnlockRetries: number;
  lateReturnAlertEnabled: boolean;
  lateReturnAlertMinutes: number;
  employeeUnlockScope: 'all' | 'assigned';
  /** Ask for the PIN again after the app has been in the background this long. */
  appRelockMinutes: number;
  /** Message sent to guests in Turo with their check-in link. */
  checkInMessageTemplate: string;
  homeLot: Geofence;
}
