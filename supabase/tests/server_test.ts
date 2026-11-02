// End-to-end server test against a real Postgres with the migrations applied.
// Run:  SUPABASE_DB_URL=postgres://... deno test -A supabase/tests/server_test.ts
// WARNING: wipes the app's tables in that database. Never point it at the live project.
import { assert, assertEquals } from 'jsr:@std/assert@1.0.13';
import { checkInAttempt, checkInStatus } from '../functions/_shared/checkin.ts';
import { db } from '../functions/_shared/db.ts';
import { applyEmail } from '../functions/_shared/email.ts';
import { runTick } from '../functions/_shared/tick.ts';
import { pretendVehicleControl } from '../functions/_shared/vehicles.ts';

const sql = db();
const vehicles = pretendVehicleControl(sql);
const IN_LOT = { lat: 33.9462, lng: -118.3838 };
const MIN = 60_000;

/** Turo's short local format, e.g. "11/5/26 6:30 am" (Pacific). */
function turoTime(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: '2-digit', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.month}/${p.day}/${p.year} ${p.hour}:${p.minute} ${String(p.dayPeriod).toLowerCase()}`;
}

function bookedEmail(id: string, guest: string, start: Date, end: Date) {
  return {
    messageId: `msg-booked-${id}`,
    receivedAt: new Date().toISOString(),
    subject: `${guest}’s trip with your Genesis GV70 is booked!`,
    body: `${guest}’s trip is booked.\n\n    Genesis GV70 2026\n\n            booked by ${guest}\n\n            Trip start: ${turoTime(start)}\n        Trip end: ${turoTime(end)}\n\n            You earn: $300.00\n            ${guest}\n                    (555) 010-0000\n\n            Reservation ID #${id}\n`,
  };
}

Deno.test('server: emails → bookings → guest check-in → relock → auto-lock', async () => {
  await sql`truncate bookings, activity, emails, payouts, earning_extras, tasks_extra, task_done, task_alerts_sent, late_alerts_sent`;
  await sql`update telemetry set lock_state = 'locked', moving = false, engine_on = false, lat = ${IN_LOT.lat}, lng = ${IN_LOT.lng}, parked_since = now() - interval '5 hours', last_unlocked_at = null`;

  const now = new Date();
  // 1. Booking email → booking (pickup in 20 min, so the window is open). Same email twice → applied once.
  const email = bookedEmail('90000001', 'Taylor', new Date(now.getTime() + 20 * MIN), new Date(now.getTime() + 3 * 24 * 60 * MIN));
  assertEquals((await applyEmail(sql, email)).status, 'applied');
  assertEquals((await applyEmail(sql, email)).status, 'duplicate');
  const [b] = await sql`select * from bookings where id = '90000001'`;
  assertEquals(b.car_id, 'gv70');
  assertEquals(Number(b.earnings), 300);
  assertEquals(b.check_in_token.length, 32);

  // 2. Guest page: status, then a location outside the lot (quietly refused), then inside (unlocks).
  const status = await checkInStatus(sql, b.check_in_token, now);
  assertEquals(status?.guestFirstName, 'Taylor');
  assertEquals(status?.expired, false);
  const away = await checkInAttempt(sql, vehicles, { token: b.check_in_token, lat: 34.05, lng: -118.25, accuracy: 10 }, now);
  assertEquals(away && !away.ok && away.reason, 'outside_lot');
  const ok = await checkInAttempt(sql, vehicles, { token: b.check_in_token, ...IN_LOT, accuracy: 10 }, now);
  assert(ok?.ok);
  assertEquals((await sql`select lock_state from telemetry where car_id = 'gv70'`)[0].lock_state, 'unlocked');

  // 3. Countdown runs out without the car moving → relocked (and not double-handled by auto-lock).
  const later = new Date(now.getTime() + 11 * MIN);
  const t1 = await runTick(sql, vehicles, later);
  assert(t1.actions.includes('guest_relock'));
  assert(!t1.actions.includes('auto_lock'));
  assertEquals((await sql`select check_in_state from bookings where id = '90000001'`)[0].check_in_state, 'relocked');
  assertEquals((await sql`select lock_state from telemetry where car_id = 'gv70'`)[0].lock_state, 'locked');

  // 4. A car left unlocked in the lot for 20 min → auto-locked.
  await sql`update telemetry set lock_state = 'unlocked', last_unlocked_at = now() - interval '20 minutes', parked_since = now() - interval '20 minutes' where car_id = 'tx'`;
  const t2 = await runTick(sql, vehicles, new Date());
  assert(t2.actions.includes('auto_lock'));
  assertEquals((await sql`select lock_state from telemetry where car_id = 'tx'`)[0].lock_state, 'locked');

  // 5. Payout, claim deadline and cancellation emails.
  await applyEmail(sql, { messageId: 'msg-pay-1', receivedAt: now.toISOString(), subject: 'Your earnings are on the way!', body: 'Cha-ching! We’ve sent your earnings payment of $1,234.56.' });
  assertEquals(Number((await sql`select amount from payouts where id = 'msg-pay-1'`)[0].amount), 1234.56);
  await applyEmail(sql, {
    messageId: 'msg-claim-1',
    receivedAt: now.toISOString(),
    subject: 'Reminder — 7 days left to resolve directly with Jordan',
    body: 'Lexus TX 2026\n\nLicense plate: 0TEST00\n\nIncident number: 7654321\n\nfile a claim with Turo by Sunday, December 6, 2026 at 11:30 AM. Simply reply.',
  });
  const [claim] = await sql`select * from tasks_extra where id = 'claim-7654321'`;
  assertEquals(claim.car_id, 'tx');
  await applyEmail(sql, {
    messageId: 'msg-cancel-1',
    receivedAt: now.toISOString(),
    subject: 'Taylor has canceled their trip with your Genesis GV70',
    body: 'Taylor has canceled this trip\n\n            Reservation ID #90000001',
  });
  assertEquals((await sql`select canceled from bookings where id = '90000001'`)[0].canceled, true);

  // 6. Everything that happened is in the activity log, with owner notifications flagged.
  const acts = (await sql`select action from activity order by at`).map((r) => r.action);
  for (const a of ['booking_received', 'guest_unlock', 'guest_relock', 'auto_lock', 'booking_canceled']) assert(acts.includes(a), `missing ${a}`);
  await sql.end();
});
