// Lock/unlock on the server. Today: pretend (updates the telemetry table only).
// When Smartcar is connected, add a Smartcar implementation here and pick it in vehicleControl()
// (Smartcar keys go in the function secrets: SMARTCAR_CLIENT_ID / SMARTCAR_CLIENT_SECRET, never in the app).
import type { Sql } from './db.ts';

export interface VehicleControl {
  lock(carId: string): Promise<void>;
  unlock(carId: string): Promise<void>;
}

export function pretendVehicleControl(sql: Sql): VehicleControl {
  return {
    async lock(carId) {
      await sql`update telemetry set lock_state = 'locked', updated_at = now() where car_id = ${carId}`;
    },
    async unlock(carId) {
      await sql`update telemetry set lock_state = 'unlocked', last_unlocked_at = now(), updated_at = now() where car_id = ${carId}`;
    },
  };
}

export function vehicleControl(sql: Sql): VehicleControl {
  // if (Deno.env.get('SMARTCAR_CLIENT_ID')) return smartcarVehicleControl(sql);
  return pretendVehicleControl(sql);
}
