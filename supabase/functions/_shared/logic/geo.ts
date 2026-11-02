// GENERATED from src/logic/geo.ts by scripts/sync-server-logic.mjs. Edit the original, not this copy.
import type { Geofence, LatLng } from './types.ts';

/** Ray-casting point-in-polygon test. Fine for lot-sized areas. */
export function isInsidePolygon(point: LatLng, polygon: LatLng[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses =
      a.latitude > point.latitude !== b.latitude > point.latitude &&
      point.longitude <
        ((b.longitude - a.longitude) * (point.latitude - a.latitude)) / (b.latitude - a.latitude) +
          a.longitude;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function isInLot(point: LatLng, lot: Geofence): boolean {
  return isInsidePolygon(point, lot.polygon);
}

/** Great-circle distance in meters. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function polygonCenter(polygon: LatLng[]): LatLng {
  const n = polygon.length || 1;
  return {
    latitude: polygon.reduce((s, p) => s + p.latitude, 0) / n,
    longitude: polygon.reduce((s, p) => s + p.longitude, 0) / n,
  };
}

export function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  if (miles < 0.1) return `${Math.round(meters * 3.281)} ft`;
  return `${miles.toFixed(1)} mi`;
}
