// Database access for the Edge Functions. Uses the direct Postgres connection Supabase provides
// to every function (SUPABASE_DB_URL), so the same code also runs against a local Postgres in tests.
import postgres from 'npm:postgres@3.4.9';
import type { TaskDoneMap } from './logic/tasks.ts';
import type { ActivityAction, Actor, Booking, Car, CarTelemetry, Settings, Task } from './logic/types.ts';

export type Sql = ReturnType<typeof postgres>;

let client: Sql | null = null;
export function db(): Sql {
  if (!client) {
    const url = Deno.env.get('SUPABASE_DB_URL');
    if (!url) throw new Error('SUPABASE_DB_URL is not set');
    client = postgres(url, { prepare: false, max: 3 }); // prepare:false for Supabase's connection pooler
  }
  return client;
}

const iso = (d: Date | string | null): string | null => (d === null ? null : new Date(d).toISOString());

export function carName(car: Car | undefined): string {
  if (!car) return 'your car';
  return `${car.year ? `${car.year} ` : ''}${car.make} ${car.model}`;
}

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export function toBooking(r: Row): Booking {
  return {
    id: r.id,
    reservationId: r.id,
    carId: r.car_id,
    guestFirstName: r.guest_first_name,
    guestPhone: r.guest_phone ?? undefined,
    tripStart: iso(r.trip_start)!,
    tripEnd: iso(r.trip_end)!,
    earnings: Number(r.earnings),
    canceled: r.canceled,
    checkInToken: r.check_in_token,
    turoConversationUrl: r.turo_conversation_url ?? undefined,
    linkSentAt: iso(r.link_sent_at),
    checkIn: { state: r.check_in_state, unlockCount: r.unlock_count, lastUnlockAt: iso(r.last_unlock_at) },
  };
}

export function toTelemetry(r: Row): CarTelemetry {
  return {
    carId: r.car_id,
    position: { latitude: r.lat, longitude: r.lng },
    engineOn: r.engine_on,
    moving: r.moving,
    parkedSince: iso(r.parked_since),
    lockState: r.lock_state,
    lastUnlockedAt: iso(r.last_unlocked_at),
    updatedAt: iso(r.updated_at)!,
  };
}

export function toCar(r: Row): Car {
  return {
    id: r.id,
    year: r.year,
    make: r.make,
    model: r.model,
    color: r.color ?? undefined,
    plate: r.plate ?? undefined,
    smartcarVehicleId: r.smartcar_vehicle_id ?? undefined,
    zubieDeviceId: r.zubie_device_id ?? undefined,
  };
}

/** Everything the automation pass needs, in the app's own shapes. */
export async function loadState(sql: Sql) {
  const [settingsRows, carRows, telRows, bookingRows, extraRows, doneRows, alertRows, lateRows] = await Promise.all([
    sql`select data from settings where id = 1`,
    sql`select * from cars order by id`,
    sql`select * from telemetry`,
    sql`select * from bookings where trip_end > now() - interval '14 days'`,
    sql`select * from tasks_extra`,
    sql`select * from task_done`,
    sql`select key from task_alerts_sent`,
    sql`select booking_id from late_alerts_sent`,
  ]);
  const settings = settingsRows[0].data as Settings;
  const cars = carRows.map(toCar);
  const telemetry: Record<string, CarTelemetry> = Object.fromEntries(telRows.map((r) => [r.car_id, toTelemetry(r)]));
  const bookings = bookingRows.map(toBooking);
  const extraTasks: Task[] = extraRows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    detail: r.detail ?? undefined,
    bookingId: r.booking_id ?? undefined,
    carId: r.car_id ?? undefined,
    dueAt: iso(r.due_at)!,
    source: r.source,
  }));
  const taskDone: TaskDoneMap = Object.fromEntries(doneRows.map((r) => [r.task_id, { at: iso(r.done_at)!, by: r.done_by }]));
  return {
    settings,
    cars,
    telemetry,
    bookings,
    extraTasks,
    taskDone,
    taskAlertsSent: alertRows.map((r) => r.key as string),
    lateAlertsSent: lateRows.map((r) => r.booking_id as string),
  };
}

export async function logActivity(
  sql: Sql,
  action: ActivityAction,
  actor: Actor,
  opts: { carId?: string | null; detail?: string; notify?: boolean } = {},
) {
  await sql`
    insert into activity (action, actor, car_id, detail, notify)
    values (${action}, ${sql.json(actor)}, ${opts.carId ?? null}, ${opts.detail ?? null}, ${opts.notify ?? false})`;
}

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extraHeaders } });
}

/** Constant-time compare for shared secrets. */
export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
