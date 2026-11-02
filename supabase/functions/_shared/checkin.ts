// Guest check-in: the private link's page asks for status (GET) and reports location (POST).
import { carName, logActivity, toBooking, toCar, toTelemetry, type Sql } from './db.ts';
import { countdownEndsAt, evaluateCheckIn, isLinkExpired, pickupWindow, REFUSAL_MESSAGES, retriesLeft } from './logic/guestCheckIn.ts';
import type { Settings } from './logic/types.ts';
import type { VehicleControl } from './vehicles.ts';

// Refusals that just mean "not yet" (guest still walking up, GPS warming up): don't log or notify.
const QUIET = new Set(['outside_lot', 'location_inaccurate', 'too_early', 'already_unlocked']);

async function load(sql: Sql, token: string) {
  const rows = await sql`select * from bookings where check_in_token = ${token}`;
  if (!rows.length) return null;
  const booking = toBooking(rows[0]);
  const [carRows, telRows, setRows] = await Promise.all([
    sql`select * from cars where id = ${booking.carId}`,
    sql`select * from telemetry where car_id = ${booking.carId}`,
    sql`select data from settings where id = 1`,
  ]);
  return { booking, car: carRows[0] ? toCar(carRows[0]) : undefined, tel: telRows[0] ? toTelemetry(telRows[0]) : undefined, settings: setRows[0].data as Settings };
}

/** What the guest page shows. Only the guest's first name and the car, nothing else. */
export async function checkInStatus(sql: Sql, token: string, now = new Date()) {
  const s = await load(sql, token);
  if (!s) return null;
  const win = pickupWindow(s.booking, s.settings);
  return {
    guestFirstName: s.booking.guestFirstName,
    car: carName(s.car),
    pickupOpensAt: win.opensAt.toISOString(),
    pickupClosesAt: win.closesAt.toISOString(),
    state: s.booking.checkIn.state,
    expired: isLinkExpired(s.booking, s.settings, now),
    retriesLeft: retriesLeft(s.booking, s.settings),
    countdownEndsAt: countdownEndsAt(s.booking, s.settings)?.toISOString() ?? null,
  };
}

export async function checkInAttempt(
  sql: Sql,
  vehicles: VehicleControl,
  input: { token: string; lat: number; lng: number; accuracy: number },
  now = new Date(),
): Promise<{ ok: true; countdownEndsAt: string } | { ok: false; reason: string; message: string } | null> {
  const s = await load(sql, input.token);
  if (!s) return null;
  const guest = { kind: 'guest' as const, bookingId: s.booking.id, name: s.booking.guestFirstName };
  const d = evaluateCheckIn(s.booking, { position: { latitude: input.lat, longitude: input.lng }, accuracyM: input.accuracy }, s.tel, s.settings, now);
  if (!d.ok) {
    if (!QUIET.has(d.reason)) {
      await logActivity(sql, 'guest_failed', guest, { carId: s.booking.carId, detail: REFUSAL_MESSAGES[d.reason], notify: true });
    }
    return { ok: false, reason: d.reason, message: REFUSAL_MESSAGES[d.reason] };
  }
  await vehicles.unlock(s.booking.carId);
  const at = now.toISOString();
  await sql`
    update bookings set check_in_state = 'unlocked', unlock_count = unlock_count + 1, last_unlock_at = ${at}, updated_at = now()
    where id = ${s.booking.id}`;
  await logActivity(sql, 'guest_unlock', guest, {
    carId: s.booking.carId,
    detail: d.isRetry ? 'Unlocked again from check-in link' : 'Unlocked from check-in link',
    notify: true,
  });
  return { ok: true, countdownEndsAt: new Date(now.getTime() + s.settings.guestCountdownMinutes * 60_000).toISOString() };
}
