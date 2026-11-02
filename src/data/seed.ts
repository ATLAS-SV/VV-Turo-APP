// Pretend data used until Smartcar, Zubie and the Gmail booking reader are connected.
import type { Booking, Car, CarTelemetry, Settings, Trip } from '../logic/types';

const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

// PLACEHOLDER home lot: a rectangle near LAX. Replace with the real lot boundary
// (Executive settings → Home lot) once the address is confirmed.
export const PLACEHOLDER_HOME_LOT = {
  name: 'Home lot',
  address: 'Address TBD (placeholder near LAX)',
  polygon: [
    { latitude: 33.947, longitude: -118.385 },
    { latitude: 33.947, longitude: -118.3825 },
    { latitude: 33.9455, longitude: -118.3825 },
    { latitude: 33.9455, longitude: -118.385 },
  ],
};

export const IN_LOT = { latitude: 33.9462, longitude: -118.3838 };

export const DEFAULT_SETTINGS: Settings = {
  autoLockParkedMinutes: 10,
  guestCountdownMinutes: 10,
  pickupWindowBeforeMinutes: 30,
  pickupWindowAfterMinutes: 120,
  guestUnlockRetries: 2,
  lateReturnAlertEnabled: true,
  lateReturnAlertMinutes: 60,
  employeeUnlockScope: 'all',
  appRelockMinutes: 5,
  homeLot: PLACEHOLDER_HOME_LOT,
};

export const SEED_CARS: Car[] = [
  { id: 'gv70', year: 2026, make: 'Genesis', model: 'GV70', color: '#2E3A4F' },
  { id: 'tx', year: 2026, make: 'Lexus', model: 'TX', color: '#8C8C8C' },
  { id: 'bmw3', year: null, make: 'BMW', model: '3 Series', color: '#1F4E8C' },
  { id: 'rogue', year: null, make: 'Nissan', model: 'Rogue', color: '#A23B2A' },
];

export function seedTelemetry(now: number): CarTelemetry[] {
  return [
    {
      carId: 'gv70',
      position: { latitude: 33.9466, longitude: -118.3843 },
      engineOn: false,
      moving: false,
      parkedSince: iso(now - 5 * 60 * MIN),
      lockState: 'locked',
      lastUnlockedAt: iso(now - 5 * 60 * MIN),
      updatedAt: iso(now),
    },
    {
      // Demo: left unlocked in the lot 12 minutes ago → auto-lock fires.
      carId: 'tx',
      position: { latitude: 33.9459, longitude: -118.3832 },
      engineOn: false,
      moving: false,
      parkedSince: iso(now - 12 * MIN),
      lockState: 'unlocked',
      lastUnlockedAt: iso(now - 12 * MIN),
      updatedAt: iso(now),
    },
    {
      // On a guest trip in Santa Monica.
      carId: 'bmw3',
      position: { latitude: 34.0119, longitude: -118.4916 },
      engineOn: true,
      moving: true,
      parkedSince: null,
      lockState: 'locked',
      lastUnlockedAt: iso(now - 26 * 60 * MIN),
      updatedAt: iso(now),
    },
    {
      // Demo: trip ended 90 min ago, still not back → late-return alert.
      carId: 'rogue',
      position: { latitude: 33.9617, longitude: -118.3531 },
      engineOn: false,
      moving: false,
      parkedSince: iso(now - 70 * MIN),
      lockState: 'locked',
      lastUnlockedAt: iso(now - 3 * 24 * 60 * MIN),
      updatedAt: iso(now),
    },
  ];
}

export function seedTrips(now: number): Trip[] {
  const h = 60 * MIN;
  return [
    { id: 't1', carId: 'gv70', departedAt: iso(now - 30 * h), arrivedAt: iso(now - 5 * h), distanceMi: 142.3, fromLabel: 'Home lot', toLabel: 'Home lot', stops: 6 },
    { id: 't2', carId: 'gv70', departedAt: iso(now - 80 * h), arrivedAt: iso(now - 50 * h), distanceMi: 88.1, fromLabel: 'Home lot', toLabel: 'Home lot', stops: 4 },
    { id: 't3', carId: 'tx', departedAt: iso(now - 50 * MIN), arrivedAt: iso(now - 12 * MIN), distanceMi: 9.4, fromLabel: 'Car wash, Inglewood', toLabel: 'Home lot', stops: 1 },
    { id: 't4', carId: 'tx', departedAt: iso(now - 74 * h), arrivedAt: iso(now - 26 * h), distanceMi: 311.7, fromLabel: 'Home lot', toLabel: 'Home lot', stops: 9 },
    { id: 't5', carId: 'bmw3', departedAt: iso(now - 26 * h), arrivedAt: null, distanceMi: 47.2, fromLabel: 'Home lot', toLabel: 'Santa Monica (driving)', stops: 3 },
    { id: 't6', carId: 'rogue', departedAt: iso(now - 52 * h), arrivedAt: iso(now - 70 * MIN), distanceMi: 63.9, fromLabel: 'Home lot', toLabel: 'Inglewood', stops: 5 },
  ];
}

function token() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export function seedBookings(now: number): Booking[] {
  const h = 60 * MIN;
  const base = { canceled: false, checkIn: { state: 'waiting' as const, unlockCount: 0, lastUnlockAt: null } };
  return [
    // Pickup window is open right now → use "Simulate guest arrival" to try the check-in flow.
    { ...base, id: 'b1', reservationId: '48213377', carId: 'gv70', guestFirstName: 'Maria', guestPhone: '(310) 555-0142', tripStart: iso(now + 20 * MIN), tripEnd: iso(now + 3 * 24 * h), earnings: 412.5, checkInToken: token() },
    { ...base, id: 'b2', reservationId: '48190021', carId: 'bmw3', guestFirstName: 'Devin', guestPhone: '(424) 555-0199', tripStart: iso(now - 26 * h), tripEnd: iso(now + 22 * h), earnings: 186.0, checkInToken: token(), checkIn: { state: 'started', unlockCount: 1, lastUnlockAt: iso(now - 26 * h) } },
    { ...base, id: 'b3', reservationId: '48155902', carId: 'rogue', guestFirstName: 'Priya', guestPhone: '(213) 555-0175', tripStart: iso(now - 52 * h), tripEnd: iso(now - 90 * MIN), earnings: 139.75, checkInToken: token(), checkIn: { state: 'started', unlockCount: 1, lastUnlockAt: iso(now - 52 * h) } },
    { ...base, id: 'b4', reservationId: '48240388', carId: 'tx', guestFirstName: 'James', guestPhone: '(562) 555-0110', tripStart: iso(now + 2 * 24 * h), tripEnd: iso(now + 5 * 24 * h), earnings: 655.0, checkInToken: token() },
    { ...base, id: 'b5', reservationId: '48251174', carId: 'rogue', guestFirstName: 'Alex', tripStart: iso(now + 4 * 24 * h), tripEnd: iso(now + 6 * 24 * h), earnings: 201.4, checkInToken: token(), canceled: true, checkIn: { state: 'expired', unlockCount: 0, lastUnlockAt: null } },
  ];
}
