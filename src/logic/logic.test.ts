import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, IN_LOT } from '../data/seed';
import { evaluateAutoLock, isLateReturn } from './autoLock';
import { planAutomation } from './automation';
import { isInLot } from './geo';
import { evaluateCheckIn, evaluateCountdown, pickupWindow, retriesLeft } from './guestCheckIn';
import { canUnlockCar, can } from './permissions';
import { MAX_PIN_ATTEMPTS, NO_LOCKOUT, lockedUntil, registerFailure, validatePinFormat } from './pin';
import { minutesInRange } from './hours';
import type { Booking, CarTelemetry, User } from './types';

const NOW = new Date('2026-11-02T03:00:00Z');
const minAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const minFromNow = (m: number) => new Date(NOW.getTime() + m * 60_000).toISOString();
const AWAY = { latitude: 34.0119, longitude: -118.4916 };
const S = DEFAULT_SETTINGS;

function tel(p: Partial<CarTelemetry> = {}): CarTelemetry {
  return {
    carId: 'c1',
    position: IN_LOT,
    engineOn: false,
    moving: false,
    parkedSince: minAgo(60),
    lockState: 'unlocked',
    lastUnlockedAt: minAgo(60),
    updatedAt: NOW.toISOString(),
    ...p,
  };
}

function booking(p: Partial<Booking> = {}, checkIn: Partial<Booking['checkIn']> = {}): Booking {
  return {
    id: 'b1',
    reservationId: 'r1',
    carId: 'c1',
    guestFirstName: 'Maria',
    tripStart: minFromNow(10),
    tripEnd: minFromNow(3000),
    earnings: 100,
    canceled: false,
    checkInToken: 'tok',
    ...p,
    checkIn: { state: 'waiting', unlockCount: 0, lastUnlockAt: null, ...checkIn },
  };
}

describe('geofence', () => {
  it('knows inside vs outside the lot', () => {
    expect(isInLot(IN_LOT, S.homeLot)).toBe(true);
    expect(isInLot(AWAY, S.homeLot)).toBe(false);
  });
});

describe('auto-lock', () => {
  it('locks an unlocked car parked in the lot long enough', () => {
    expect(evaluateAutoLock(tel(), S, NOW).action).toBe('lock');
  });
  it('never locks outside the home lot', () => {
    expect(evaluateAutoLock(tel({ position: AWAY }), S, NOW).action).toBe('none');
  });
  it('waits for the parked timer', () => {
    expect(evaluateAutoLock(tel({ parkedSince: minAgo(5), lastUnlockedAt: minAgo(5) }), S, NOW).action).toBe('none');
  });
  it('restarts the timer when someone unlocks a car that has been parked for hours', () => {
    expect(evaluateAutoLock(tel({ parkedSince: minAgo(300), lastUnlockedAt: minAgo(2) }), S, NOW).action).toBe('none');
  });
  it('does not lock while the engine is on', () => {
    expect(evaluateAutoLock(tel({ engineOn: true }), S, NOW).action).toBe('none');
  });
  it('leaves cars with a running guest countdown alone', () => {
    const b = booking({}, { state: 'unlocked', unlockCount: 1, lastUnlockAt: minAgo(1) });
    expect(evaluateAutoLock(tel(), S, NOW, [b]).action).toBe('none');
  });
  it('respects the adjustable setting', () => {
    const s = { ...S, autoLockParkedMinutes: 90 };
    expect(evaluateAutoLock(tel(), s, NOW).action).toBe('none');
  });
});

describe('late return', () => {
  it('alerts when the car is not back an hour after trip end', () => {
    const b = booking({ tripStart: minAgo(3000), tripEnd: minAgo(61) });
    expect(isLateReturn(b, tel({ position: AWAY }), S, NOW)).toBe(true);
    expect(isLateReturn(b, tel(), S, NOW)).toBe(false);
  });
});

describe('guest check-in', () => {
  const inLot = { position: IN_LOT, accuracyM: 20 };
  it('has a 30 min before → 2 h after window', () => {
    const w = pickupWindow(booking({ tripStart: NOW.toISOString() }), S);
    expect(w.opensAt.getTime()).toBe(NOW.getTime() - 30 * 60_000);
    expect(w.closesAt.getTime()).toBe(NOW.getTime() + 120 * 60_000);
  });
  it('unlocks when guest is in the lot during the window', () => {
    expect(evaluateCheckIn(booking(), inLot, tel(), S, NOW)).toEqual({ ok: true, isRetry: false });
  });
  it('refuses too early, outside the lot, poor GPS, canceled', () => {
    const early = booking({ tripStart: minFromNow(45) });
    expect(evaluateCheckIn(early, inLot, tel(), S, NOW)).toMatchObject({ reason: 'too_early' });
    expect(evaluateCheckIn(booking(), { position: AWAY, accuracyM: 5 }, tel(), S, NOW)).toMatchObject({ reason: 'outside_lot' });
    expect(evaluateCheckIn(booking(), { position: IN_LOT, accuracyM: 500 }, tel(), S, NOW)).toMatchObject({ reason: 'location_inaccurate' });
    expect(evaluateCheckIn(booking({ canceled: true }), inLot, tel(), S, NOW)).toMatchObject({ reason: 'expired' });
  });
  it('allows the set number of "unlock again" retries', () => {
    const after = (n: number) => booking({}, { state: 'relocked', unlockCount: n });
    expect(evaluateCheckIn(after(1), inLot, tel(), S, NOW)).toEqual({ ok: true, isRetry: true });
    expect(evaluateCheckIn(after(2), inLot, tel(), S, NOW)).toEqual({ ok: true, isRetry: true });
    expect(evaluateCheckIn(after(3), inLot, tel(), S, NOW)).toMatchObject({ reason: 'no_retries_left' });
    expect(retriesLeft(after(3), S)).toBe(0);
  });
  it('relocks when the countdown runs out, or marks the trip started if the car moves', () => {
    const b = booking({}, { state: 'unlocked', unlockCount: 1, lastUnlockAt: minAgo(11) });
    expect(evaluateCountdown(b, tel(), S, NOW)).toBe('relock');
    expect(evaluateCountdown(b, tel({ moving: true }), S, NOW)).toBe('started');
    const fresh = booking({}, { state: 'unlocked', unlockCount: 1, lastUnlockAt: minAgo(3) });
    expect(evaluateCountdown(fresh, tel(), S, NOW)).toBe('waiting');
  });
});

describe('automation pass', () => {
  it('relocks a guest car instead of also auto-locking it', () => {
    const b = booking({}, { state: 'unlocked', unlockCount: 1, lastUnlockAt: minAgo(11) });
    const actions = planAutomation({
      cars: [{ id: 'c1', year: 2026, make: 'X', model: 'Y' }],
      telemetry: { c1: tel() },
      bookings: [b],
      settings: S,
      lateAlertsSent: [],
      now: NOW,
    });
    expect(actions.map((a) => a.type)).toEqual(['guest_relock']);
  });
});

describe('PIN', () => {
  it('rejects weak PINs', () => {
    expect(validatePinFormat('12')).not.toBeNull();
    expect(validatePinFormat('1111')).not.toBeNull();
    expect(validatePinFormat('1234')).not.toBeNull();
    expect(validatePinFormat('4829')).toBeNull();
    expect(validatePinFormat('48291')).not.toBeNull(); // exactly 4 digits
  });
  it('locks the app after several wrong attempts, longer each time', () => {
    let s = NO_LOCKOUT;
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) s = registerFailure(s, NOW);
    expect(lockedUntil(s, NOW)?.getTime()).toBe(NOW.getTime() + 5 * 60_000);
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) s = registerFailure(s, NOW);
    expect(lockedUntil(s, NOW)?.getTime()).toBe(NOW.getTime() + 10 * 60_000);
  });
});

describe('roles', () => {
  const emp: User = { id: 'e', name: 'Helper', role: 'employee', pinHash: '', pinSalt: '', assignedCarIds: ['c1'], createdAt: '' };
  it('hides money and settings from employees', () => {
    expect(can(emp, 'viewEarnings')).toBe(false);
    expect(can(emp, 'editSettings')).toBe(false);
  });
  it('can limit employee unlocks to assigned cars', () => {
    expect(canUnlockCar(emp, 'c2', S)).toBe(true);
    expect(canUnlockCar(emp, 'c2', { ...S, employeeUnlockScope: 'assigned' })).toBe(false);
    expect(canUnlockCar(emp, 'c1', { ...S, employeeUnlockScope: 'assigned' })).toBe(true);
  });
  it('per-person car access wins over the old fleet-wide setting', () => {
    const picked: User = { ...emp, carAccess: 'picked' };
    expect(canUnlockCar(picked, 'c1', S)).toBe(true);
    expect(canUnlockCar(picked, 'c2', S)).toBe(false);
    const all: User = { ...emp, carAccess: 'all', assignedCarIds: [] };
    expect(canUnlockCar(all, 'c2', { ...S, employeeUnlockScope: 'assigned' })).toBe(true);
    expect(canUnlockCar({ ...emp, role: 'executive', carAccess: 'picked', assignedCarIds: [] }, 'c2', S)).toBe(true);
  });
});

describe('hours', () => {
  it('clips shifts to the range and counts open shifts up to now', () => {
    const shifts = [
      { id: 's1', userId: 'u', clockIn: minAgo(120), clockOut: minAgo(60) },
      { id: 's2', userId: 'u', clockIn: minAgo(30), clockOut: null },
    ];
    expect(minutesInRange(shifts, new Date(minAgo(90)), NOW, NOW)).toBe(60);
  });
});

describe('check-in message', () => {
  it('fills in guest, car, link, window and countdown', async () => {
    const { buildCheckInMessage, DEFAULT_CHECK_IN_TEMPLATE } = await import('./checkInMessage');
    const m = buildCheckInMessage(DEFAULT_CHECK_IN_TEMPLATE, { guest: 'Maria', car: '2026 Genesis GV70', link: 'https://x/c/abc', window: '2 PM to 4 PM', countdown: 10 });
    expect(m).toContain('Hi Maria!');
    expect(m).toContain('https://x/c/abc');
    expect(m).toContain('within 10 minutes');
    expect(m).toContain('Valadon Ventures');
    expect(m).not.toMatch(/\{\w+\}/);
  });
});

describe('money', () => {
  it('splits a month into earned vs upcoming by type, and sums payouts', async () => {
    const { earningItems, summarizeMonth, monthWhen, addMonths } = await import('./money');
    const now = new Date(2026, 10, 15, 12); // Nov 15 2026 local
    const at = (d: number) => new Date(2026, 10, d, 12).toISOString();
    const items = earningItems(
      [booking({ id: 'x', tripEnd: at(10), earnings: 300 }), booking({ id: 'y', tripEnd: at(25), earnings: 200 }), booking({ id: 'z', tripEnd: at(5), earnings: 999, canceled: true })],
      [
        { id: 'i', type: 'incentive', amount: 50, date: at(3), description: 'Bonus', source: 'pretend' },
        { id: 'c', type: 'reimbursement', amount: 650, date: new Date(2026, 9, 3).toISOString(), description: 'Oct claim payout', source: 'pretend' },
      ],
    );
    const s = summarizeMonth(items, [{ id: 'p', sentAt: at(12), amount: 340, method: 'Bank', source: 'pretend' }], '2026-11', now);
    expect(s.earned).toBe(350);
    expect(s.upcoming).toBe(200);
    expect(s.byType.trip).toEqual({ earned: 300, upcoming: 200 });
    expect(s.byType.reimbursement.earned).toBe(0);
    expect(s.missed).toBe(999); // canceled booking: shown as missed, not counted
    expect(s.byType.missed.earned).toBe(999);
    expect(s.tripCount).toBe(2);
    expect(s.paidOut).toBe(340);
    expect(monthWhen('2026-10', now)).toBe('past');
    expect(monthWhen('2026-12', now)).toBe('future');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });
});

describe('overview schedule', () => {
  it('lists cars going out today and tomorrow, skipping canceled', async () => {
    const { pickupsOn, tomorrow } = await import('./bookings');
    const now = new Date(2026, 10, 2, 9);
    const list = [
      booking({ id: 'a', tripStart: new Date(2026, 10, 2, 15).toISOString() }),
      booking({ id: 'b', tripStart: new Date(2026, 10, 2, 11).toISOString() }),
      booking({ id: 'c', tripStart: new Date(2026, 10, 3, 10).toISOString() }),
      booking({ id: 'd', tripStart: new Date(2026, 10, 3, 8).toISOString(), canceled: true }),
    ];
    expect(pickupsOn(list, now).map((b) => b.id)).toEqual(['b', 'a']);
    expect(pickupsOn(list, tomorrow(now)).map((b) => b.id)).toEqual(['c']);
  });
});

describe('tasks', () => {
  it('builds a checklist per booking with due times, status and reminders', async () => {
    const { allTasks, reminderTimes } = await import('./tasks');
    const b = booking({ tripStart: minFromNow(30), tripEnd: minFromNow(3000) });
    const tasks = allTasks([b, booking({ id: 'gone', canceled: true })], [], { 'b1:checkin_photos': { at: NOW.toISOString(), by: 'S' } }, S, NOW);
    expect(tasks.map((t) => t.kind)).toEqual(['confirm_license', 'checkin_photos', 'checkin_dash_photo', 'checkout_photos', 'checkout_dash_photo']);
    const byKind = Object.fromEntries(tasks.map((t) => [t.kind, t]));
    expect(byKind.confirm_license.status).toBe('overdue'); // due 60 min before a start 30 min away
    expect(byKind.checkin_photos.status).toBe('done');
    expect(byKind.checkin_dash_photo.status).toBe('due_soon');
    expect(byKind.checkout_photos.status).toBe('upcoming');
    const r = reminderTimes(byKind.checkin_dash_photo, S);
    expect(r[0].at.getTime()).toBe(Date.parse(minFromNow(30)) - 60 * 60_000);
  });
});

describe('booking calendar', () => {
  it('builds month weeks and finds bookings overlapping a day', async () => {
    const { monthGrid, bookingsOnDay } = await import('./bookings');
    const weeks = monthGrid('2026-11'); // Nov 1 2026 is a Sunday
    expect(weeks[0][0]?.getDate()).toBe(1);
    expect(weeks.flat().filter(Boolean).length).toBe(30);
    const b = booking({ tripStart: new Date(2026, 10, 3, 10).toISOString(), tripEnd: new Date(2026, 10, 5, 9).toISOString() });
    expect(bookingsOnDay([b], new Date(2026, 10, 4))).toHaveLength(1);
    expect(bookingsOnDay([b], new Date(2026, 10, 6))).toHaveLength(0);
    expect(bookingsOnDay([{ ...b, canceled: true }], new Date(2026, 10, 4))).toHaveLength(0);
  });
});

describe('task reminders', () => {
  it('sends each reminder once and skips long-overdue ones', async () => {
    const { allTasks, planTaskAlerts } = await import('./tasks');
    const tasks = allTasks([booking({ tripStart: minFromNow(30) }), booking({ id: 'old', tripStart: minAgo(3000), tripEnd: minFromNow(100) })], [], {}, S, NOW);
    const first = planTaskAlerts(tasks, [], NOW);
    expect(first.send.map((s) => `${s.task.id}:${s.kind}`)).toEqual(['b1:confirm_license:overdue', 'b1:checkin_photos:soon', 'b1:checkin_dash_photo:soon']);
    expect(first.markSent).toContain('old:checkin_photos:overdue'); // silently marked, not sent
    expect(planTaskAlerts(tasks, first.markSent, NOW).send).toHaveLength(0);
  });
});
