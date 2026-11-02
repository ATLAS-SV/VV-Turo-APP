// Pretend data used until Smartcar, Zubie and the Gmail booking reader are connected.
import { DEFAULT_CHECK_IN_TEMPLATE } from '../logic/checkInMessage';
import type { Booking, Car, CarTelemetry, EarningItem, EarningType, Payout, Settings, Task, Trip } from '../logic/types';

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
  checkInMessageTemplate: DEFAULT_CHECK_IN_TEMPLATE,
  licenseDueMinutesBefore: 60,
  checkoutPhotosDueMinutesAfter: 120,
  taskReminderMinutes: 60,
  taskPhoneNotifications: true,
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

function tomorrowAt(now: number, hour: number) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, hour).getTime();
}

export function seedBookings(now: number): Booking[] {
  const h = 60 * MIN;
  const base = { canceled: false, checkIn: { state: 'waiting' as const, unlockCount: 0, lastUnlockAt: null } };
  return [
    // Pickup window is open right now → use "Simulate guest arrival" to try the check-in flow.
    { ...base, id: 'b1', reservationId: '48213377', carId: 'gv70', guestFirstName: 'Maria', guestPhone: '(310) 555-0142', tripStart: iso(now + 20 * MIN), tripEnd: iso(now + 3 * 24 * h), earnings: 412.5, checkInToken: token() },
    { ...base, id: 'b2', reservationId: '48190021', carId: 'bmw3', guestFirstName: 'Devin', guestPhone: '(424) 555-0199', tripStart: iso(now - 26 * h), tripEnd: iso(now + 22 * h), earnings: 186.0, checkInToken: token(), checkIn: { state: 'started', unlockCount: 1, lastUnlockAt: iso(now - 26 * h) } },
    { ...base, id: 'b3', reservationId: '48155902', carId: 'rogue', guestFirstName: 'Priya', guestPhone: '(213) 555-0175', tripStart: iso(now - 52 * h), tripEnd: iso(now - 90 * MIN), earnings: 139.75, checkInToken: token(), checkIn: { state: 'started', unlockCount: 1, lastUnlockAt: iso(now - 52 * h) } },
    { ...base, id: 'b4', reservationId: '48240388', carId: 'tx', guestFirstName: 'James', guestPhone: '(562) 555-0110', tripStart: iso(now + 3 * 24 * h), tripEnd: iso(now + 5 * 24 * h), earnings: 655.0, checkInToken: token() },
    // Going out tomorrow at 10:00.
    { ...base, id: 'b6', reservationId: '48262540', carId: 'tx', guestFirstName: 'Sam', guestPhone: '(310) 555-0188', tripStart: iso(tomorrowAt(now, 10)), tripEnd: iso(tomorrowAt(now, 10) + 30 * h), earnings: 248.0, checkInToken: token() },
    { ...base, id: 'b5', reservationId: '48251174', carId: 'rogue', guestFirstName: 'Alex', tripStart: iso(now + 4 * 24 * h), tripEnd: iso(now + 6 * 24 * h), earnings: 201.4, checkInToken: token(), canceled: true, checkIn: { state: 'expired', unlockCount: 0, lastUnlockAt: null } },
  ];
}

// ---------- pretend money history (until Turo payout/earnings emails are read) ----------

/** Small deterministic random generator so pretend numbers don't change between launches. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function seedMoney(now: number): { extras: EarningItem[]; payouts: Payout[] } {
  const rand = rng(42);
  const day = 24 * 60 * MIN;
  const extras: EarningItem[] = [];
  const carIds = SEED_CARS.map((c) => c.id);
  const today = new Date(now);
  const startOfMonth = (offset: number) => new Date(today.getFullYear(), today.getMonth() + offset, 1).getTime();
  let n = 0;
  const add = (type: EarningType, amount: number, date: number, description: string, carId?: string) =>
    extras.push({ id: `p${n++}`, type, amount: Math.round(amount * 100) / 100, date: iso(date), carId, description, source: 'pretend' });

  // Past 6 months of trips (current month only up to a few days ago), plus next 2 months already booked.
  for (let m = -6; m <= 2; m++) {
    const from = startOfMonth(m);
    const to = startOfMonth(m + 1);
    for (const carId of carIds) {
      const trips = m > 0 ? 1 + Math.floor(rand() * 2) : 3 + Math.floor(rand() * 3);
      for (let t = 0; t < trips; t++) {
        const date = from + rand() * (to - from);
        if (m === 0 && date > now - 3 * day && date < now + 3 * day) continue; // real bookings cover this week
        add('trip', 90 + rand() * 380, date, 'Trip', carId);
        if (rand() < 0.35 && date < now) add('reimbursement', 12 + rand() * 55, date + day, rand() < 0.5 ? 'Tolls' : 'Fuel', carId);
      }
    }
    if (m <= 0 && rand() < 0.7) add('incentive', [25, 50, 75][Math.floor(rand() * 3)], from + 20 * day, 'Host bonus');
  }
  // Claim payouts count as reimbursements (as on Turo's earnings page).
  add('reimbursement', 650, startOfMonth(-2) + 12 * day, 'Claim reimbursement: rear bumper', 'bmw3');
  add('reimbursement', 180, startOfMonth(-4) + 6 * day, 'Claim reimbursement: cleaning / smoking', 'rogue');
  // Missed earnings: guest cancellations and other money that never came in.
  for (let m = -6; m <= 0; m++) {
    if (rand() < 0.6) add('missed', 120 + rand() * 260, startOfMonth(m) + (5 + rand() * 20) * day, 'Guest canceled', carIds[Math.floor(rand() * carIds.length)]);
    if (rand() < 0.4) add('missed', 15 + rand() * 40, startOfMonth(m) + (5 + rand() * 20) * day, 'Unbilled tolls', carIds[Math.floor(rand() * carIds.length)]);
  }

  // Turo pays out a few days after earnings: one payout each Friday for the previous week's items.
  const payouts: Payout[] = [];
  const earned = extras.filter((e) => Date.parse(e.date) < now).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  let i = 0;
  for (let t = startOfMonth(-6); t < now; t += day) {
    if (new Date(t).getDay() !== 5) continue;
    let sum = 0;
    while (i < earned.length && Date.parse(earned[i].date) < t - 3 * day) sum += earned[i++].amount;
    if (sum > 0) payouts.push({ id: `pay${t}`, sentAt: iso(t + 10 * 60 * MIN), amount: Math.round(sum * 100) / 100, method: 'Bank transfer', source: 'pretend' });
  }
  return { extras, payouts };
}

// ---------- pretend tasks (until claims are read from Turo emails in Gmail) ----------

export function seedTasks(now: number): { extra: Task[]; done: Record<string, { at: string; by: string }> } {
  const day = 24 * 60 * MIN;
  const extra: Task[] = [
    {
      id: 'claim-bmw3-bumper',
      kind: 'claim',
      title: 'Pending claim: reply to Turo claims team',
      detail: 'BMW 3 Series rear bumper. Turo asked for repair estimate and photos.',
      carId: 'bmw3',
      dueAt: iso(now + 2 * day),
      source: 'pretend',
    },
    {
      id: 'claim-rogue-cleaning',
      kind: 'claim',
      title: 'Pending claim: upload cleaning receipt',
      detail: 'Nissan Rogue smoking/cleaning fee. Waiting on your receipt.',
      carId: 'rogue',
      dueAt: iso(now + 5 * day),
      source: 'pretend',
    },
  ];
  // Trips already under way: their check-in tasks were done.
  const done: Record<string, { at: string; by: string }> = {};
  for (const b of ['b2', 'b3']) {
    for (const k of ['confirm_license', 'checkin_photos', 'checkin_dash_photo']) done[`${b}:${k}`] = { at: iso(now - 2 * day), by: 'Sebastian' };
  }
  return { extra, done };
}
