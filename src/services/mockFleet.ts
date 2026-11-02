// Pretend fleet: stands in for Smartcar + Zubie until they're connected.
import { IN_LOT, seedTelemetry, seedTrips } from '../data/seed';
import type { Car, CarTelemetry, LockState, Trip } from '../logic/types';
import type { Tracker, VehicleControl } from './types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

class MockFleet implements VehicleControl, Tracker {
  private telemetry = new Map<string, CarTelemetry>();
  private trips: Trip[] = [];

  /** Start from saved state (so pretend cars stay put between launches) or fresh seed data. */
  load(saved: CarTelemetry[] | null, savedTrips: Trip[] | null) {
    const now = Date.now();
    this.telemetry = new Map((saved ?? seedTelemetry(now)).map((t) => [t.carId, t]));
    this.trips = savedTrips ?? seedTrips(now);
  }

  snapshot() {
    return { telemetry: [...this.telemetry.values()], trips: this.trips };
  }

  private set(carId: string, patch: Partial<CarTelemetry>) {
    const cur = this.telemetry.get(carId);
    if (!cur) throw new Error(`Unknown car ${carId}`);
    this.telemetry.set(carId, { ...cur, ...patch, updatedAt: new Date().toISOString() });
  }

  async lock(car: Car): Promise<LockState> {
    await delay(700);
    this.set(car.id, { lockState: 'locked' });
    return 'locked';
  }

  async unlock(car: Car): Promise<LockState> {
    await delay(700);
    this.set(car.id, { lockState: 'unlocked', lastUnlockedAt: new Date().toISOString() });
    return 'unlocked';
  }

  async getTelemetry(cars: Car[]): Promise<CarTelemetry[]> {
    const now = new Date().toISOString();
    for (const car of cars) {
      if (!this.telemetry.has(car.id)) {
        this.telemetry.set(car.id, {
          carId: car.id,
          position: IN_LOT,
          engineOn: false,
          moving: false,
          parkedSince: now,
          lockState: 'locked',
          lastUnlockedAt: null,
          updatedAt: now,
        });
      }
    }
    return cars.map((c) => this.telemetry.get(c.id)!);
  }

  async getTrips(carId: string): Promise<Trip[]> {
    return this.trips
      .filter((t) => t.carId === carId)
      .sort((a, b) => Date.parse(b.departedAt) - Date.parse(a.departedAt));
  }

  // ---- Simulation helpers (pretend-data mode only) ----

  /** Guest starts the car and drives out of the lot. */
  simulateDriveOff(carId: string) {
    const t = this.telemetry.get(carId);
    if (!t) return;
    this.set(carId, {
      engineOn: true,
      moving: true,
      parkedSince: null,
      position: { latitude: t.position.latitude + 0.004, longitude: t.position.longitude + 0.003 },
    });
    this.trips.push({
      id: `t${Date.now()}`,
      carId,
      departedAt: new Date().toISOString(),
      arrivedAt: null,
      distanceMi: 0.3,
      fromLabel: 'Home lot',
      toLabel: 'Driving',
      stops: 0,
    });
  }

  /** Car parks back in the home lot (engine off), optionally left unlocked. */
  simulateReturnToLot(carId: string, leaveUnlocked: boolean) {
    const now = new Date().toISOString();
    this.set(carId, {
      engineOn: false,
      moving: false,
      parkedSince: now,
      position: IN_LOT,
      ...(leaveUnlocked ? { lockState: 'unlocked' as const, lastUnlockedAt: now } : {}),
    });
    const open = this.trips.find((t) => t.carId === carId && !t.arrivedAt);
    if (open) Object.assign(open, { arrivedAt: now, toLabel: 'Home lot' });
  }
}

export const mockFleet = new MockFleet();
export const vehicleControl: VehicleControl = mockFleet;
export const tracker: Tracker = mockFleet;
