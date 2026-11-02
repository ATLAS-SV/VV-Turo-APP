import type { Car, CarTelemetry, LockState, Trip } from '../logic/types';

/**
 * Lock/unlock. Real version: Smartcar. Smartcar's client secret and car tokens must live on a
 * server, never in the phone app, so the real implementation will call our own backend.
 */
export interface VehicleControl {
  lock(car: Car): Promise<LockState>;
  unlock(car: Car): Promise<LockState>;
}

/** Location, parked/moving state and trip history. Real version: Zubie (ZinC API), via our backend. */
export interface Tracker {
  getTelemetry(cars: Car[]): Promise<CarTelemetry[]>;
  getTrips(carId: string): Promise<Trip[]>;
}
