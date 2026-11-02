// The every-minute automation pass, run by pg_cron → the `tick` function.
// Same rules as the app: auto-lock (home lot only), guest countdown relock, trip started,
// link expiry, late-return alerts, and task reminders.
import { carName, loadState, logActivity, type Sql } from './db.ts';
import { planAutomation } from './logic/automation.ts';
import { allTasks, planTaskAlerts } from './logic/tasks.ts';
import type { VehicleControl } from './vehicles.ts';

export async function runTick(sql: Sql, vehicles: VehicleControl, now = new Date()) {
  const s = await loadState(sql);
  const actions = planAutomation({
    cars: s.cars,
    telemetry: s.telemetry,
    bookings: s.bookings,
    settings: s.settings,
    lateAlertsSent: s.lateAlertsSent,
    now,
  });
  const carById = (id: string) => s.cars.find((c) => c.id === id);
  const bookingById = (id: string) => s.bookings.find((b) => b.id === id)!;

  for (const a of actions) {
    switch (a.type) {
      case 'auto_lock':
        await vehicles.lock(a.carId);
        await logActivity(sql, 'auto_lock', { kind: 'system' }, { carId: a.carId, detail: a.reason, notify: true });
        break;
      case 'guest_relock': {
        const b = bookingById(a.bookingId);
        await vehicles.lock(a.carId);
        await sql`update bookings set check_in_state = 'relocked', updated_at = now() where id = ${b.id}`;
        await logActivity(sql, 'guest_relock', { kind: 'guest', bookingId: b.id, name: b.guestFirstName }, {
          carId: a.carId,
          detail: `Countdown ran out (${s.settings.guestCountdownMinutes} min) before the car moved`,
          notify: true,
        });
        break;
      }
      case 'trip_started': {
        const b = bookingById(a.bookingId);
        await sql`update bookings set check_in_state = 'started', updated_at = now() where id = ${b.id}`;
        await logActivity(sql, 'trip_started', { kind: 'guest', bookingId: b.id, name: b.guestFirstName }, {
          carId: a.carId,
          detail: 'Car left the lot. Check-in link expired.',
        });
        break;
      }
      case 'expire_link':
        await sql`update bookings set check_in_state = 'expired', updated_at = now() where id = ${a.bookingId}`;
        break;
      case 'late_return': {
        const b = bookingById(a.bookingId);
        await sql`insert into late_alerts_sent (booking_id) values (${b.id}) on conflict do nothing`;
        await logActivity(sql, 'late_return', { kind: 'system' }, {
          carId: a.carId,
          detail: `${carName(carById(a.carId))} isn't back ${s.settings.lateReturnAlertMinutes}+ min after ${b.guestFirstName}'s trip ended`,
          notify: true,
        });
        break;
      }
    }
  }

  // Task reminders ("due soon" and "overdue"), once each.
  const tasks = allTasks(s.bookings, s.extraTasks, s.taskDone, s.settings, now);
  const plan = planTaskAlerts(tasks, s.taskAlertsSent, now);
  for (const key of plan.markSent) await sql`insert into task_alerts_sent (key) values (${key}) on conflict do nothing`;
  for (const { task, kind } of plan.send) {
    const b = task.bookingId ? s.bookings.find((x) => x.id === task.bookingId) : undefined;
    const detail = [task.title, b?.guestFirstName, task.carId ? carName(carById(task.carId)) : null].filter(Boolean).join(' · ');
    await logActivity(sql, kind === 'overdue' ? 'task_overdue' : 'task_reminder', { kind: 'system' }, { carId: task.carId, detail, notify: true });
  }

  return { actions: actions.map((a) => a.type), reminders: plan.send.length };
}
